require('shelljs/global');

var createHandler = require('github-webhook-handler');
var webhook = createHandler({path: '/webhook', secret: 'a-not-so-secret-secret'});

var path = require('path');
var paths = require('../package.json').paths;
var Promise = require('promise');
var rootdir = path.resolve(__dirname + '/../') + path.sep;
var reposdir = rootdir + paths.repos + path.sep;

webhook.on('ping', function(event) {
    console.log('ping, pong');
});

webhook.on('create', function(event) {
    var payload = event.payload;

    if (payload.ref_type === 'tag') {
        downloadBabel(payload.repository.full_name, payload.ref)
            .then(createBowerBuild)
            .catch(function(err) {
                console.error('ERROR: ' + err);
            })
    }

});

webhook.on('error', function(err) {
    console.error('ERROR:' + err.message);
});

function downloadBabel(repo, version) {

    return new Promise(function(resolve, reject) {
        var url = 'https://github.com/' + repo + '/tarball/' + version,
        outputdir = rootdir + paths.build + path.sep + version,
        tarfile = outputdir + '.tgz';

        console.log('downloading from: ' + url + ' to: ' + tarfile);

        if (exec('curl -L -s -o ' + tarfile + ' ' + url).code !== 0)
            return reject(new Error('unable to download: ' + url + ' to:' + tarfile));

        mkdir('-p', outputdir);

        console.log('extracting tarfile: ' + tarfile + ' to: ' + outputdir);

        if (exec('tar xzf ' + tarfile + ' --strip-components=1 -C ' + outputdir, {silent: true}).code !== 0)
            return reject(new Error('unable to extract tarfile'));

        console.log('removing tarfile: ' + tarfile);

        rm('-f', tarfile);

        resolve({version: version, directory: outputdir});
    });

}

function createBowerBuild(options) {

    // change to dir
    cd(options.directory);

    console.log('running npm install -d');

    if (exec('npm install -d --silent', {silent: true}).code !== 0)
        throw new Error('running npm install -d');

    console.log('running scripts/bootstrap.js');
    if (exec('node scripts/bootstrap.js', {silent: true}).code !== 0)
        throw new Error('running bootstrap.js');

    cd('packages/babel');

    console.log('running packages/babel/scripts/build-dist.sh');
    if (exec('scripts/build-dist.sh', {silent: true}).code !== 0)
        throw new Error('running build-dist.sh');

    console.log('copying builds');
    cp('-f', 'dist/external-helpers*', reposdir + 'bower-babel-external-helpers/');
    cp('-f', 'dist/polyfill*', reposdir + 'bower-babel-polyfill/');

    if (process.env.NODE_ENV === 'production') {
        cd(reposdir + 'bower-babel-external-helpers/');
        bumpBowerAndCommit(options.version);
        cd(reposdir + 'bower-babel-polyfill/');
        bumpBowerAndCommit(options.version);
    }

    // cleanup
    console.log('cleaning up build dir: ' + options.directory);
    cd(rootdir);
    rm('-rf', options.directory);
}

function bumpBowerAndCommit(version) {
    console.log(pwd()  + ' bumping to bower version ' + version);

    exec('bower version ' + version); // bump version, bower doesn't auto commit if it's a submodule line 61 bower/lib/commands/version.js
    exec('git add .');

    console.log('committing and tagging');
    exec('git commit -a -m "' + version + '"');
    exec('git tag -a ' + version + ' -m "Version Bump"');
    exec('git push --tags');
}

module.exports = webhook;