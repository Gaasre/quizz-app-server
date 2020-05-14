var experience_system = {
    MAX_LEVEL: 100,
    EXPONENT: 1.5,
    BASEXP: 100,
    nextLevel: function (level) {
        return Math.floor(this.BASEXP * (level ^ this.EXPONENT))
    },
    readyToLevelup: function (player) {
        return player.xp >= player.nextLevelXP;
    },
    AddXP: function (player, xp) {
        player.xp += xp;
        player.socket.emit('xp_gain', {
            xp: player.xp
        });
        return this.readyToLevelup(player);
    },
    ApplyLevel: function (player, levelup) {
        player.xp = player.xp + levelup.xp;
        player.level = player.level + levelup.level;
        player.nextLevelXP = this.nextLevel(player.level);
    },
    CreateLevelUp: function (player) {
        var levelup = {
            xp: -player.nextLevelXP,
            level: 1
        };
        return levelup
    },
    ApplyXP: function (player, xp) {
        this.AddXP(player, xp);
        while (this.readyToLevelup(player)) {
            var levelup = this.CreateLevelUp(player);
            var levelNumber = player.level + levelup.level;
            console.log(`Level Up! (Level ${levelNumber})`);
            this.ApplyLevel(player, levelup);
            player.socket.emit('level_up', {
                level: player.level,
                xp: player.xp,
                nextLevelXP: player.nextLevelXP
            });
        }
    }
};

module.exports = experience_system