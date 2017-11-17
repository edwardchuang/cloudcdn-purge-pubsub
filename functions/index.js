const dns = require('dns')
const url = require('url');
var google = require('googleapis');
var compute = google.compute('v1');

project_list = {
  // TODO: scan urlMaps across the project lists
  'cloudcdn.k8s.cool': { 'project': 'CHANGEME', 'urlMap': 'cloudcdn-k8s-cool' }
};

function authorize(callback, purgeData) {
  google.auth.getApplicationDefault(function(err, authClient) {
    if (err) {
      console.log('authentication failed: ', err);
      return;
    }
    if (authClient.createScopedRequired && authClient.createScopedRequired()) {
      var scopes = [
        'https://www.googleapis.com/auth/compute', 
        'https://www.googleapis.com/auth/cloud-platform'
      ];
      authClient = authClient.createScoped(scopes);
    }
    callback(authClient, purgeData);
  });
}

exports.purgeCloudCDN = function (event, mainCallback) {
  const pubsubMessage = event.data;
  const purgeUrl = new Buffer(pubsubMessage.data, 'base64').toString('utf-8');

  authorize(function(authClient, purgeData) {
    if (undefined == purgeUrl) {
      console.log('empty purgeData / url');
      return;
    }

    urlInfo = url.parse(purgeUrl);
    if ('' == urlInfo.hostname || '' == urlInfo.pathname) {
      console.log('unable to format url: ' + purgeUrl);
      return;
    }
    
    if (undefined === project_list[urlInfo.hostname]) {
      console.log('cant find proper project / urlmap in project_list: ' + purgeUrl);
      return;
    }

    var request = {
      project: project_list[urlInfo.hostname].project,
      urlMap: project_list[urlInfo.hostname].urlMap,
      resource: {
        host: urlInfo.hostname,
        path: urlInfo.pathname
      },
      auth: authClient
    };

    var callback = function(err, response) {
      if (err) {
        mainCallback(new Error(err));
        return;
      }

      console.log(request);
      console.log('cacheInvalidation operation created: ' + response.name);
      mainCallback(); // return for cloud function parent event handler
      return;
    };

    compute.urlMaps.invalidateCache(request, callback);

  }, { 'url': purgeUrl });  
};
