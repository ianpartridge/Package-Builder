/**
 * Copyright IBM Corporation 2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = { getRepositoriesToHandle: getRepositoriesToHandle, clone: clone,
                   calculateNewVersions: calculateNewVersions };

const readline = require('readline');
const fs = require('fs');
const GithubAPI = require("github");
const git = require("nodegit");
const untildify = require('untildify');
const async = require('async');
const gittags = require("git-tags");
const GittoolsRepository = require("git-tools");
const spmHandler = require( __dirname + '/spmHandler.js');

function getRepositoriesToHandle(callback) {
    async.parallel({
        repositoriesToUpdate: getRepositoriesToUpdate,
        ibmSwiftRepositories: getIBMSwiftRepositories
    }, function(error, result) {
        if (error) {
            return callback(error);
        }
        const repositoriesToHandle = result.ibmSwiftRepositories.filter(function(repository) {
            return result.repositoriesToUpdate[repository.name];
        });

        callback(null, repositoriesToHandle);
    });
}

function getRepositoriesToUpdate(callback) {
    var repositoriesToUpdate = {};

    const repositoriesToUpdateReader = readline.createInterface({
        input: fs.createReadStream('repos_to_update.txt')
    });

    repositoriesToUpdateReader.on('line', function(line) {
        line = line.split('#')[0]
        line = line.trim()
        if (!line) {
            return
        }
        repositoriesToUpdate[line] = true
    });

    repositoriesToUpdateReader.on('close', function() {
        callback(null, repositoriesToUpdate);
    });
}

function getIBMSwiftRepositories(callback) {
    const github = new GithubAPI({
        protocol: "https",
        host: "api.github.com",
        Promise: require('bluebird'),
        followRedirects: false,
        timeout: 5000
    });

    fs.readFile(untildify('~/.ssh/package_updater_github_token.txt'), 'utf8', function (error, token) {
        if (error) {
            callback(error, null);
        }

        github.authenticate({ type: "oauth", token: token.trim() });

        github.repos.getForOrg({
            org: "IBM-Swift",
            type: "all",
            per_page: 300
        }, callback);
    });
}

function clone(repositories, workDirectory, callback) {
    function cloneRepository(repository, callback) {
        cloneRepositoryByURLAndName(repository.git_url, repository.name, workDirectory,
            function(error, clonedRepository) {
                if (error) {
                    return callback(error, null);
                }
                getDecoratedRepository(clonedRepository, repository.name, workDirectory,
                                       callback);
            });
    }
    async.map(repositories, cloneRepository, callback);
}

function cloneRepositoryByURLAndName(repositoryURL, repositoryName, workDirectory, callback) {
    console.log(`cloning repository ${repositoryName}`);
    const repositoryDirectory = workDirectory + '/' + repositoryName;
    git.Clone(repositoryURL, repositoryDirectory).then(function(clonedRepository) {
        console.log(`cloned repository ${clonedRepository.workdir()}`)
        callback(null, clonedRepository);
    }).catch(function(error) {
        console.log(`Error in cloning: ${error}`);
        callback(error, null);
    });
}

// @param repositories - githubAPI Repository
// @param callback callback(error, decoratedRepositories)
// decorated Repositories (githubAPI Repository, largestVersion, name, packageJSON)
function getDecoratedRepository(repository, repositoryName, workDirectory, callback) {
    gittags.latest(repository.workdir(), function(error, largestVersion) {
        if (error) {
            callback(error);
        }
        console.log(`last tag in ${repositoryName} is ${largestVersion}`);
        spmHandler.getPackageAsJSON(repository.workdir(), function(error, packageJSON) {
            callback(error, { repository: repository, name: repositoryName,
                              largestVersion: largestVersion, packageJSON: packageJSON});
        });
    });
}

// @param repository - decorated repository (githubAPI Repository, largestVersion, name, packageJSON)
function isKituraCoreRepository(repository) {
    return repository.name.startsWith('Kitura');
}

// @param repositories - decorated repositories (githubAPI Repository, largestVersion, name, packageJSON)
function calculateNewVersions(kituraVersion, repositories, callback) {
    console.log(`got ${repositories.length} repositories, ${kituraVersion}`);
    calculatedRepositoriesToBumpVersion(repositories,
        function(error, repositoriesToBumpVersion) {
            console.log(`${repositoriesToBumpVersion.length} repositories to bump version`);
            callback(null, repositoriesToBumpVersion);
        });
}

// @param repositories - decorated repositories (githubAPI Repository, largestVersion, name, packageJSON)
function calculatedRepositoriesToBumpVersion(repositories, callback) {
    getChangedRepositories(repositories, function(error, changedRepositories) {
        const currentIterationChangedRepositories = changedRepositories;
        const unchangedRepositories = repositories.filter(repository => changedRepositories.indexOf(repository) < 0);

        console.log(`${changedRepositories.length} repositories were changed, ${unchangedRepositories.length} did not change`);


        callback(null, changedRepositories);
    });
}

// depender, dependee terms from https://en.wiktionary.org/wiki/dependee
function getTransitiveClosureOfDependencies(repositoriesToCheck, dependeeRepositories) {
    const currentIterationDependeeRepositories = dependeeRepositories;

}

// @param repositoriesToCheck - decorated repositories (githubAPI Repository, largestVersion, name, packageJSON)
// @param dependeeRepositories - decorated repositories (githubAPI Repository, largestVersion, name, packageJSON)
function getDependerRepositories(repositoriesToCheck, dependeeRepositories, callback) {

}

// @param repositoriesToCheck - decorated repositories (githubAPI Repository, largestVersion, name, packageJSON)
function getChangedRepositories(repositories, callback) {
    async.filter(repositories, function(repository, filterCallback) {
        wasRepositoryChangedAfterVersion(repository.largestVersion, repository.repository,
                                         filterCallback);
    }, callback);
}

// @param githubAPI repository
function wasRepositoryChangedAfterVersion(version, repository, callback) {
    getTagCommit(version, repository.workdir(), function(error, commitSHA) {
        if (error) {
            return callback(error, false);
        }
        repository.getHeadCommit().then(function(headCommit) {
            callback(null, !(commitSHA === headCommit.sha()));
        });
    });
}

function getTagCommit(tag, repositoryDirectory, callback) {
    const gittoolsRepository = new GittoolsRepository(repositoryDirectory);
    gittoolsRepository.tags(function(error, tags) {
        if (error) {
            return callback(error, null);
        }
        const matchingTags = tags.filter(tagToFilter => tagToFilter.name == tag);
        if (matchingTags.length != 1) {
            return callback(`no matching tags for ${version} in ${repositoryDirectory}`, null);
        }
        const matchingTag = matchingTags[0];
        callback(error, matchingTag.sha);
    });
}
