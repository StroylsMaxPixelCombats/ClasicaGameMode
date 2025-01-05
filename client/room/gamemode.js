import { DisplayValueHeader } from 'pixel_combats/basic';
import { Game, Players, Inventory, LeaderBoard, BuildBlocksSet, Teams, Damage, BreackGraph, Ui, Properties, GameMode, Spawns, Timers, TeamsBalancer, NewGame, NewGameVote } from 'pixel_combats/room';
import * as Teams from './default_teams.js';
import * as DefaultTimer from './default_timer.js';

// Константы:
var MaxScores = 5;
var WaitingModeSeconts = 10;
var BuildModeSeconds = 30;
var GameModeSeconds = 120;
var EndGameSeconds = 5;
var EndOfMatchTime = 11;

// Константы, имён:
var WaitingStateValue = "Waiting";
var BuildModeStateValue = "BuildMode";
var GameStateValue = "Game";
var EndOfGameStateValue = "EndOfGame";
var EndOfMatchStateValue = "EndOfMatch";
var scoresProp = "Scores";

// Постоянные, переменные:
var mainTimer = Timers.GetContext().Get("Main");
var stateProp = Properties.GetContext().Get("State");
var winTeamIdProp = Properties.GetContext().Get("WinTeam");

// Параметры, создания - комнаты:
Damage.GetContext().FriendlyFire.Value = GameMode.Parameters.GetBool("FriendlyFire");
Map.Rotation = GameMode.Parameters.GetBool("MapRotation");
BreackGraph.OnlyPlayerBlocksDmg = GameMode.Parameters.GetBool("PartialDesruction");
BreackGraph.WeakBlocks = GameMode.Parameters.GetBool("LoosenBlocks");

// Блок игрока, всегда - усилен:
BreackGraph.PlayerBlockBoost = true;

//Запрещаем, урон - гранатами:
Damage.GetContext().GranadeTouchExplosion.Value = false;

// Параметры:
Properties.GetContext().GameModeName.Value = "GameModes/Team Dead Match";
TeamsBalancer.IsAutoBalance = true; 
Ui.GetContext().MainTimerId.Value = mainTimer.Id;

// Стандартные, команды:
Teams.Add("Blue", "Teams/Blue", new Color(0, 0, 1, 0));
Teams.Add("Red", "Teams/Red", new Color(1, 0, 0, 0));
Teams.Get("Blue").Spawns.SpawnPointsGroups.Add(1);
Teams.Get("Red").Spawns.SpawnPointsGroups.Add(2);
Teams.Get("Red").Build.BlocksSet.Value = BuildBlocksSet.Red;
Teams.Get("Blue").Build.BlocksSet.Value = BuildBlocksSet.Blue;
// ЛидерБорды:
LeaderBoard.PlayerLeaderBoardValues = [
	{
		Value: "Kills",
		DisplayName: "Statistics/Kills",
		ShortDisplayName: "Statistics/KillsShort"
	},
	{
		Value: "Deaths",
		DisplayName: "Statistics/Deaths",
		ShortDisplayName: "Statistics/DeathsShort"
	},
	{
		Value: "Scores",
		DisplayName: "Statistics/Scores",
		ShortDisplayName: "Statistics/ScoresShort"
	},
  {
       Value: "Spawns",
       DisplayName: "Statistics/Spawns",
       ShortDisplayName: "Statistics/SpawnsShort"
    }    
  
];
LeaderBoard.TeamLeaderBoardValue = {
	Value: scoresProp,
	DisplayName: "Statistics\Scores",
	ShortDisplayName: "Statistics\ScoresShort"
};

// Вес, пропуска - в лидерБорде:
LeaderBoard.TeamWeightGetter.Set(function(Team) {
	var prop = Team.Properties.Get(scoresProp);
	if (prop.Value == null) return 0;
	return prop.Value;
});
// Вес, игрока - в лидерБорде:
LeaderBoard.PlayersWeightGetter.Set(function(Player) {
	var prop = Player.Properties.Get("Scores");
	if (prop.Value == null) return 0;
	return prop.Value;
});

// Задаём, что выводить - в табе:
Ui.GetContext().TeamProp1.Value = { Team: "Blue", Prop: scoresProp };
Ui.GetContext().TeamProp2.Value = { Team: "Red", Prop: scoresProp };

// Задаём, очки - в команде:
for (arr = Teams.All; arr.MoveNext();) {
	  arr.Current.Properties.Get(scoresProp).Value = 0;
}

// Разрешаем игроку, зайти в - команду:
Teams.OnRequestJoinTeam.Add(function(Player,Team){Team.Add(Player);});
// Задаём, спавн - игроку:
Teams.OnPlayerChangeTeam.Add(function(Player) {
 if (stateProp.value === GameStateValue) 
	 return;
	Player.Spawns.Spawn();
});

// Счётчик, смертей:
Damage.OnDeath.Add(function(Player) {
	++Player.Properties.Deaths.Value;
});
// Счётчик, спавнов:
Spawns.OnSpawn.Add(function(Player) {
  ++Player.Properties.Spawns.Value;
});
// Счётчик, киллов:
Damage.OnKill.Add(function(Player, Killed) {
	if (Killed.Team != null && Killed.Team != Player.Team) {
		++Player.Properties.Kills.Value;
	  Player.Properties.Scores.Value += 150;
	}
});

// Система, числителя - команды:
function GetWinTeam(){
	winTeam = null;
	wins = 0;
	noAlife = true;
	for (arr = Teams.All; arr.MoveNext();) {
		if (arr.Current.GetAlivePlayersCount() > 0) {
			++wins;
			winTeam = arr.Current;
		}
	}
	if (wins === 1) return winTeam;
	else return null;
}
function TrySwitchGameState()
{
	if (stateProp.value !== GameStateValue) 
		return;

	// Переключатели, игры:
	winTeam = null;
	wins = 0;
	alifeCount = 0;
	hasEmptyTeam = false;
	for (arr = Teams.All; arr.MoveNext();) {
		var alife = arr.Current.GetAlivePlayersCount();
		alifeCount += alife;
		if (alife > 0) {
			++wins;
			winTeam = arr.Current;
		}
		if (arr.Current.Count == 0) hasEmptyTeam = true;
	}

	if (!hasEmptyTeam && alifeCount > 0 && wins === 1) {
		log.debug("hasEmptyTeam=" + hasEmptyTeam);
		log.debug("alifeCount=" + alifeCount);
		log.debug("wins=" + wins);
		winTeamIdProp.Value = winTeam.Id;
		StartEndOfGame(winTeam);
		return;
  }
  
	if (alifeCount == 0) {
		log.debug("ïîáåäèâøèõ íåò è æèâûõ íå îñòàëîñü - íè÷üÿ");
		winTeamIdProp.Value = null;
		StartEndOfGame(null);
  }

	if (alifeCount == 0) {
		log.debug("Всё, что мы хотим - это то, что вы хотите");
		winTeamIdProp.Value = null;
		StartEndOfGame(null);
	}

	if (!mainTimer.IsStarted) {
		log.debug("Программная - отладка");
		winTeamIdProp.Value = null;
		StartEndOfGame(null);
	}
}
function OnGameStateTimer()
{
	TrySwitchGameState();
}
Damage.OnDeath.Add(TrySwitchGameState);
Players.OnPlayerDisconnected.Add(TrySwitchGameState);

// Переключатели - игровых, режимов:
mainTimer.OnTimer.Add(function() {
	switch (stateProp.value) {
	case WaitingStateValue:
		SetBuildMode();
		break;
	case BuildModeStateValue:
		SetGameMode();
		break;
	case GameStateValue:
		OnGameStateTimer();
		break;
	case EndOfGameStateValue:
		EndEndOfGame();
		break;
	case EndOfMatchStateValue:
		RestartGame();
		break;
	}
});

// Задаём, первое состояние - игры:
SetWaitingMode();

// Состояние - игры:
function SetWaitingMode() {
	stateProp.value = WaitingStateValue;
	Ui.GetContext().Hint.Value = "Ожидание, игроков...";
	Spawns.GetContext().Enable = false;
	TeamsBalancer.IsAutoBalance = true;
	mainTimer.Restart(WaitingModeSeconts);
}

function SetBuildMode() 
{
	stateProp.value = BuildModeStateValue;
	Ui.GetContext().Hint.Value = "!Застраивайте, базу и - атакуйте, врагов!";

	var inventory = Inventory.GetContext();
	inventory.Main.Value = false;
	inventory.Secondary.Value = false;
	inventory.Melee.Value = true;
	inventory.Explosive.Value = false;
	inventory.Build.Value = true;

	mainTimer.Restart(BuildModeSeconds);
	Spawns.GetContext().Enable = true;
	TeamsBalancer.IsAutoBalance = true; 
	SpawnTeams();
}
function SetGameMode() 
{
	stateProp.value = GameStateValue;
	Ui.GetContext().Hint.Value = "!Атакуйте, врагов!";
	winTeamIdProp.Value = null;

	var inventory = Inventory.GetContext();
	if (GameMode.Parameters.GetBool("OnlyKnives")) {
		inventory.Main.Value = false;
		inventory.Secondary.Value = false;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = false;
		inventory.Build.Value = true;
	} else {
		inventory.Main.Value = true;
		inventory.Secondary.Value = true;
		inventory.Melee.Value = true;
		inventory.Explosive.Value = true;
		inventory.Build.Value = true;
	}

	mainTimer.Restart(GameModeSeconds);
	Spawns.GetContext().Despawn();
	Spawns.GetContext().RespawnEnable = false;
	TeamsBalancer.IsAutoBalance = false;
	TeamsBalancer.BalanceTeams();
	SpawnTeams();
}

function StartEndOfGame(team) { 
	log.debug("win team="+team);
	stateProp.value = EndOfGameStateValue;
	if (team !== null) {
		log.debug(1);
		Ui.GetContext().Hint.Value = `team + wins!`;
		 var prop = team.Properties.Get(scoresProp);
		 if (prop.Value == null) prop.Value = 1;
		 else prop.Value = prop.Value + 1;
	}
	else Ui.GetContext().Hint.Value = "Hint/Draw";
	mainTimer.Restart(EndGameSeconds);
}
function EndEndOfGame() {
	if (winTeamIdProp.Value !== null) {
		var team = Teams.Get(winTeamIdProp.Value);
		var prop = team.Properties.Get(scoresProp);
		if (prop.Value >= MaxScores) SetEndOfMatchMode();
		else SetGameMode();
	}
	else SetGameMode();
}

function SetEndOfMatchMode() {
	stateProp.value = EndOfMatchStateValue;
	 Ui.GetContext().Hint.Value = "!Конец, матча!";

	Spawns.GetContext().Enable = false;
	Spawns.GetContext().Despawn();
	
	Game.GameOver(LeaderBoard.GetTeams());
	mainTimer.Restart(EndOfMatchTime);
}
function RestartGame() {
	Game.RestartGame();
}

function SpawnTeams() {
	var Spawns = Spawns.GetContext();
         Spawns.Spawn();
	  SpawnTeams();
	}
}

