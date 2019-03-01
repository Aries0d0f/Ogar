var Mode = require('./Mode');

function DoubleTeams() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 1;
    this.name = "DoubleTeams";
    this.decayMod = 1.5;
    this.packetLB = 51;
    this.haveTeams = true;
    this.colorFuzziness = 24;
    this.teamName = ['NTHU', 'NCTU', 'YM', 'MEOW']

    // Special
    this.teamAmount = 4; // Amount of teams. Having more than 3 teams will cause the leaderboard to work incorrectly (client issue).
    this.colors = [{
        'r': 117,
        'g': 70,
        'b': 254
    }, {
        'r': 0,
        'g': 154,
        'b': 255
    }, {
        'r': 245,
        'g': 30,
        'b': 106
    }, {
        'r': 0,
        'g': 0,
        'b': 0
    }, ]; // Make sure you add extra colors here if you wish to increase the team amount [Default colors are: Red, Green, Blue]
    this.nodes = []; // DoubleTeams
}

module.exports = DoubleTeams;
DoubleTeams.prototype = new Mode();

//Gamemode Specific Functions

DoubleTeams.prototype.fuzzColorComponent = function(component) {
    component += Math.random() * this.colorFuzziness >> 0;
    return range(component, 0, 255);
};

DoubleTeams.prototype.getTeamColor = function(team) {
    var color = this.colors[team];
    return {
        r: this.fuzzColorComponent(color.r),
        g: this.fuzzColorComponent(color.g),
        b: this.fuzzColorComponent(color.b)
    };
};

function range(a, min, max) {
    return Math.max(Math.min(a, max), min);
}

// Override

DoubleTeams.prototype.onPlayerSpawn = function(gameServer, player) {
    console.log({ 'name': player.name, 'team': this.teamName[player.team] })
    // Random color based on team
    player.color = this.getTeamColor(player.team);
    // Spawn player
    gameServer.spawnPlayer(player);
};

DoubleTeams.prototype.onServerInit = function(gameServer) {
    // Set up teams
    for (var i = 0; i < this.teamAmount; i++) {
        this.nodes[i] = [];
    }

    // migrate current players to team mode
    for (var i = 0; i < gameServer.clients.length; i++) {
        var client = gameServer.clients[i];
        if (!client) continue;
        client = client.playerTracker;
        
        this.onPlayerInit(client);
        
        client.color = this.getTeamColor(client.getTeam());
        for (var j = 0; j < client.cells.length; j++) {
            var cell = client.cells[j];
            cell.setColor(this.getTeamColor(client.team));
            this.nodes[client.team].push(cell);
        }
    }
};

DoubleTeams.prototype.onPlayerInit = function(player) {
    // Get random team
};

DoubleTeams.prototype.onCellAdd = function(cell) {
    // Add to team list
    this.nodes[cell.owner.getTeam()].push(cell);
};

DoubleTeams.prototype.onCellRemove = function(cell) {
    // Remove from team list
    var index = this.nodes[cell.owner.getTeam()].indexOf(cell);
    if (index != -1) {
        this.nodes[cell.owner.getTeam()].splice(index, 1);
    }
};

DoubleTeams.prototype.onCellMove = function(cell, gameServer) {
    var team = cell.owner.getTeam();
    
    if (cell.collisionRestoreTicks > 0) return; // Can't collide

    for (var i = 0; i < this.nodes[team].length; i++) {
        var check = this.nodes[team][i];
        if (!check) continue;
        
        if (cell.owner.pID == check.owner.pID) continue; // Same owner cells won't collide here
        if (check.collisionRestoreTicks > 0) continue; // Check cell can't collide
        
        // Push cells apart
        gameServer.collisionHandler.pushApart(cell, check);
    }
};

DoubleTeams.prototype.updateLB = function(gameServer) {
    // FFA-like
    var leaderboard = [];

    // First off remove disconenected or spectating players
    var players = [];
    gameServer.clients.forEach(function(player) {
        if (!player) return;
        if (player.playerTracker.cells.length <= 0) return;
        if (player.playerTracker.disconnect > 0) return;
        players.push(player.playerTracker);
    });

    players.sort(function(a, b) {
        try {
            return b.getScore(true) - a.getScore(true);
        } catch (e) {
            return 0;
        }
    });

    leaderboard = players.slice(0, gameServer.config.serverMaxLB);

    this.rankOne = leaderboard[0];
    gameServer.leaderboard = leaderboard;

    // Pie

    var total = 0;
    var teamMass = [];
    // Get mass
    for (var i = 0; i < this.teamAmount; i++) {
        // Set starting mass
        teamMass[i] = 0;

        // Loop through cells
        for (var j = 0; j < this.nodes[i].length; j++) {
            var cell = this.nodes[i][j];

            if (!cell) {
                continue;
            }

            teamMass[i] += cell.mass;
            total += cell.mass;
        }
    }
    // Calc percentage
    for (var i = 0; i < this.teamAmount; i++) {
        // No players
        if (total <= 0) {
            continue;
        }

        gameServer.teamleaderboard[i] = teamMass[i] / total;
    }
};
