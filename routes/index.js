require('shelljs/global');

var express = require('express');
var router = express.Router();
var path = require('path');
var paths = require('../package.json').paths;
var Promise = require('promise');
var rootdir = path.resolve(__dirname + '/../') + path.sep;

router.post('/payload', function(req, res, next) {

    if (req.body.action === 'ping') {
        res.status(200).send('Ok!');
    }

    if (req.body.ref_type === 'tag') {

        var versionId = req.body.ref;

        getVersion(req.body.repository.full_name, versionId)
            .then(createBuildVersion);
    }

    res.status(200).send('Ok!');

});


function getVersion(repo, version) {
    var url = 'https://github.com/' + repo + '/tarball/v' + version;

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
    exec('npm install -d');
    exec('node scripts/bootstrap.js');

    cd('packages/babel');
    exec('scripts/build-dist.sh');

    cp('-f', 'dist/external-helpers*', reposdir + 'babel-external-helpers/');
    cp('-f', 'dist/polyfill*', reposdir + 'babel-polyfill/');

    cd(reposdir + 'babel-external-helpers/');

    exec('bower version ' + options.version); // bower doesn't commit if it's a submodule
    exec('git add .');
    exec('git commit -a -m "v' + options.version + '"');
    exec('git tag -a v' + options.version);
    exec('git push --follow-tags');

    cd(reposdir + 'babel-polyfill/');

    exec('bower version ' + options.version); // bower doesn't commit if it's a submodule
    exec('git add .');
    exec('git commit -a -m "v' + options.version + '"');
    exec('git tag -a v' + options.version);
    exec('git push --follow-tags');

    cd(rootdir);

    rm('-rf', options.directory);
}

module.exports = router;