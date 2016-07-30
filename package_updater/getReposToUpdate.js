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

const readline = require('readline');
const fs = require('fs');

module.exports = function(callback) {
    var reposToUpdate = {};

    const reposToUpdateReader = readline.createInterface({
        input: fs.createReadStream('repos_to_update.txt')
    });

    reposToUpdateReader.on('line', function(line) {
        line = line.split('#')[0]
        line = line.trim()
        if (!line) {
            return
        }
        reposToUpdate[line] = true
    });

    reposToUpdateReader.on('close', function() {
        callback(reposToUpdate);
    });
}
