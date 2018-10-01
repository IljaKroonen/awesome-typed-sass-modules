#!/usr/bin/env node
'use strict';

var _typedCssModules = require('typed-css-modules');

var _typedCssModules2 = _interopRequireDefault(_typedCssModules);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _cosmiconfig = require('cosmiconfig');

var _cosmiconfig2 = _interopRequireDefault(_cosmiconfig);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _dartSass = require('dart-sass');

var _dartSass2 = _interopRequireDefault(_dartSass);

var _yargs = require('yargs');

var _yargs2 = _interopRequireDefault(_yargs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pkg = require('../package.json');

var sassConfig = function () {
    var rc = (0, _cosmiconfig2.default)('sass').searchSync();
    return rc === null ? {} : rc.config;
}();

var readSass = function readSass(pathName, relativeTo) {
    return new Promise(function (resolve, reject) {
        _dartSass2.default.render(Object.assign({}, sassConfig, { file: pathName }), function (err, result) {
            if (err && relativeTo && relativeTo !== '/') {
                return resolve([]);
            } else if (err && (!relativeTo || relativeTo === '/')) {
                return reject(err);
            }
            return resolve(result.css.toString());
        });
    });
};

var createTypings = function createTypings(pathName, creator, cache, handleError, handleWarning, verbose) {
    return readSass(pathName).then(function (content) {
        return creator.create(pathName, content, cache);
    }).then(function (c) {
        return c.writeFile();
    }).then(function (c) {
        if (verbose) {
            console.info('Created ' + _chalk2.default.green(c.outputFilePath));
        }
        c.messageList.forEach(function (message) {
            var warningTitle = _chalk2.default.yellow('WARNING: ' + pathName);
            var warningInfo = message;
            handleWarning(warningTitle + '\n' + warningInfo);
        });
        return c;
    }).catch(function (reason) {
        var errorTitle = _chalk2.default.red('ERROR: ' + pathName);
        var errorInfo = reason;
        handleError(errorTitle + '\n' + errorInfo);
    });
};

var createTypingsForFileOnWatch = function createTypingsForFileOnWatch(creator, cache, verbose) {
    return function (pathName) {
        var warnings = 0;
        var errors = 0;

        var handleError = function handleError(error) {
            console.error(error);
            errors += 1;
        };
        var handleWarning = function handleWarning(warning) {
            console.warn(warning);
            warnings += 1;
        };
        var onComplete = function onComplete() {
            if (warnings + errors > 0) {
                console.info(pathName + ': ' + warnings + ' warnings, ' + errors + ' errors');
            }
            warnings = 0;
            errors = 0;
        };

        return createTypings(pathName, creator, cache, handleError, handleWarning, verbose).then(onComplete);
    };
};

var createTypingsForFiles = function createTypingsForFiles(creator, cache, verbose) {
    return function (pathNames) {
        var warnings = 0;
        var errors = 0;

        var handleError = function handleError(error) {
            console.error(error);
            errors += 1;
        };
        var handleWarning = function handleWarning(warning) {
            console.warn(warning);
            warnings += 1;
        };
        var onComplete = function onComplete() {
            if (warnings + errors > 0) {
                console.info('Completed with ' + warnings + ' warnings and ' + errors + ' errors.');
            }
            errors = 0;
            warnings = 0;
        };

        return Promise.all(pathNames.map(function (pathName) {
            return createTypings(pathName, creator, cache, handleError, handleWarning, verbose);
        })).then(onComplete);
    };
};

var main = function main() {
    var yarg = _yargs2.default.usage('$0 [inputDir] [options]', 'Create .scss.d.ts from CSS modules *.scss files.', function (commandYargs) {
        commandYargs.positional('inputDir', {
            describe: 'Directory to search for scss files.',
            type: 'string',
            default: '.'
        }).example('$0 src/styles').example('$0 src -o dist').example('$0 -p styles/**/*.scss -w');
    }).detectLocale(false).version(pkg.version).option('c', {
        alias: 'camelCase',
        default: false,
        type: 'boolean',
        describe: 'Convert CSS class tokens to camelCase'
    }).option('o', {
        alias: 'outDir',
        describe: 'Output directory'
    }).option('p', {
        alias: 'pattern',
        default: '**/[^_]*.scss',
        describe: 'Glob pattern with scss files'
    }).option('w', {
        alias: 'watch',
        default: false,
        type: 'boolean',
        describe: 'Watch input directory\'s scss files or pattern'
    }).option('d', {
        alias: 'dropExtension',
        default: false,
        type: 'boolean',
        describe: 'Drop the input files extension'
    }).option('v', {
        alias: 'verbose',
        default: false,
        type: 'boolean',
        describe: 'Show verbose message'
    }).alias('h', 'help').help('h');

    var argv = yarg.argv;

    // Show help

    if (argv.h) {
        yarg.showHelp();
        return;
    }

    var searchDir = argv.inputDir;
    // Show help if no search diretory present
    if (searchDir === undefined) {
        yarg.showHelp();
        return;
    }

    // If search directory doesn't exits, exit
    if (!_fs2.default.existsSync(searchDir)) {
        console.error(_chalk2.default.red('Error: Input directory ' + searchDir + ' doesn\'t exist.'));
        return;
    }

    var filesPattern = _path2.default.join(searchDir, argv.p);

    var rootDir = process.cwd();

    var creator = new _typedCssModules2.default({
        rootDir: rootDir,
        searchDir: searchDir,
        outDir: argv.o,
        camelCase: argv.c,
        dropExtension: argv.d
    });

    var cache = !!argv.w;

    if (!argv.w) {
        (0, _glob2.default)(filesPattern, null, function (err, pathNames) {
            if (err) {
                console.error(err);
                return;
            } else if (!pathNames || !pathNames.length) {
                console.info('Creating typings for 0 files');
                return;
            }
            console.info('Creating typings for ' + pathNames.length + ' files\n');
            createTypingsForFiles(creator, cache, argv.v)(pathNames);
        });
    } else {
        console.info('Watching ' + filesPattern + ' ...\n');

        var watcher = _chokidar2.default.watch(filesPattern);
        watcher.on('add', createTypingsForFileOnWatch(creator, cache, argv.v));
        watcher.on('change', createTypingsForFileOnWatch(creator, cache, argv.v));
    }
};

main();