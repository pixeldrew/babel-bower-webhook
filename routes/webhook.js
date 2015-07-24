require('shelljs/global');

var createHandler = require('github-webhook-handler');
var webhook = createHandler({path: '/webhook', secret: 'a-not-so-secret-secret'});

var path = require('path');
var paths = require('../package.json').paths;
var Promise = require('promise');
var rootdir = path.resolve(__dirname + '/../') + path.sep;

webhook.on('create', function(event) {

    var payload = event.payload;

    if (payload.ref_type === 'tag') {
        getVersion(payload.repository.full_name, payload.ref)
            .then(createBuildVersion);
    }

});

webhook.on('error', function(err) {
    console.error('Error:', err.message);
});


function getVersion(repo, version) {
    var url = 'https://github.com/' + repo + '/tarball/' + version;

    return new Promise(function(resolve, reject) {

        var outputdir = rootdir + paths.build + path.sep + version,
        tarfile = outputdir + '.tgz';

        exec('curl -L -s -o ' + tarfile + ' ' + url);

        mkdir('-p', outputdir);
        exec('tar xzf ' + tarfile + ' --strip-components=1 -C ' + outputdir);
        rm('-f', tarfile);

        resolve({version: version, directory: outputdir});
    });

}

function createBuildVersion(options) {
    var reposdir = rootdir + paths.repos + path.sep;

    cd(options.directory);
    exec('npm install -d --silent');
    exec('node scripts/bootstrap.js', {silent:true});

    cd('packages/babel');
    exec('scripts/build-dist.sh', {silent: true});

    cp('-f', 'dist/external-helpers*', reposdir + 'babel-external-helpers/');
    cp('-f', 'dist/polyfill*', reposdir + 'babel-polyfill/');

    cd(reposdir + 'babel-external-helpers/');

    exec('bower version ' + options.version); // bower doesn't commit if it's a submodule
    exec('git add .');
    exec('git commit -a -m "' + options.version + '"');
    exec('git tag -a ' + options.version + ' -m "Version Bump"');
    //exec('git push --tags');

    cd(reposdir + 'babel-polyfill/');

    exec('bower version ' + options.version); // bower doesn't commit if it's a submodule
    exec('git add .');
    exec('git commit -a -m "' + options.version + '"');
    exec('git tag -a ' + options.version + ' -m "Version Bump"');
    //exec('git push --tags');

    cd(rootdir);

    rm('-rf', options.directory);
}

module.exports = webhook;