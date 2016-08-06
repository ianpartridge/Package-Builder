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


module.exports = Parameters;

function Parameters() {
    this.swiftVersion = null;
    this.kituraVersion = null;
    this.pushWithoutPrompt = null;
    this.submitPRsWithoutPrompt = null;
}

Parameters.prototype.read = function(callback) {
    const argv = process.argv
    const exit = process.exit

    if (argv.length < 4) {
        console.warn('Format: npm start <major Kitura version to set>.<minor Kitura version to set> <swift version to set>')
        exit();
    }

    this.kituraVersion = argv[2]
    this.swiftVersion = argv[3]

    if (!/^(\d+)\.(\d+)$/.test(this.kituraVersion)) {
        console.error('Kitura version parameter should be in the format <major>.<minor>');
        exit();
    }

    callback();
}
