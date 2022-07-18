import {kTemplatePath} from "./config.mjs";

export default class CombatReminder extends Application {
  constructor(options = {}) {
    super(options);

    this.encounters = {};
  }

  // @override
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id : "combat-reminder",
      template : `${kTemplatePath}/combat-reminder.hbs`,
      popOut : false,
      top : 0,
      left : 0
    });
  }

  static appReady() { ui.combatReminder = new CombatReminder(); }

  // Returns the total number of turns that are taken, or will be taken, from
  // the given round turn and players.
  static cumulativeTurnsFromOrder(round, turn, players) {
    return turn + players * round;
  }

  // Returns the normalized {rounds, turns} from the given players and cum.
  // turns.
  static orderFromCumulativeTurns(players, turns) {
    const round = Math.floor(turns / players);
    const turn = turns % players;
    return {round, turn};
  }

  getData() {
    const testdata = "test";
    return {testdata};
  }

  async fireAlert(to_fire) {
    console.log(to_fire);
    if (!to_fire)
      return;

    alert(to_fire.description ?? "something happened (lost details)");
  }

  // Resets round counts to 0, optionally firing the alerts.
  resetData(combat_data, fire_alerts = false) {
    if (!combatData)
      return;

    if (!fire_alerts) {
      delete this.encounters[combat_data._id];
    }

    let encounter = this.encounters[combatData._id];
    if (!encounter)
      return;

    while (encounter.reminder_heap.size() > 0) {
      this.fireAlert(encounter.reminder_heap.pop());
    }
    delete this.encounters[combatData._id];
  }

  renormalizeRounds(encounter, new_round, new_turn, num_players) {
    if (!encounter || num_players === encounter.players)
      return;

    encounter.reminder_heap.toArray().forEach(function(elem) {
      const {round, turn} = CombatReminder.orderFromCumulativeTurns(
          encounter.players, elem.end_turn);
      elem.end_turn =
          CombatReminder.cumulativeTurnsFromOrder(round, turn, num_players);
    });

    encounter.current_turn = CombatReminder.cumulativeTurnsFromOrder(
        new_round, new_turn, num_players);
    encounter.players = num_players;
    encounter.reminder_heap.heapify();
  }

  updateRound(combat) {
    // If the combat is invalid, not the focus OR hasn't started, don't update
    // anything.
    if (!combat || !combat.data.active || combat.current.round === null) {
      return;
    }

    const round = combat.current.round;
    const turn = combat.current.turn;
    const num_players = combat.turns.length ? combat.turns.length : 1;

    // If we haven't seen this encounter before, create it.
    let encounter = this.encounters[combat.data._id];
    if (!encounter) {
      this.encounters[combat.data._id] = {
        'players' : num_players,
        'current_turn' :
            CombatReminder.cumulativeTurnsFromOrder(round, turn, num_players),
        'reminder_heap' :
            new Heap((a, b) => { return b.end_turn - a.end_turn; })
      };
      return;
    }

    if (encounter.players != num_players) {
      this.renormalizeRounds(encounter, round, turn, num_players);
    } else {
      encounter.current_turn =
          CombatReminder.cumulativeTurnsFromOrder(round, turn, num_players);
    }

    while (encounter.reminder_heap.size() > 0 &&
           encounter.reminder_heap.peek().end_turn <= encounter.current_turn) {
      this.fireAlert(encounter.reminder_heap.pop());
    }
  }

  queueReminder(combat, duration, in_rounds, description, chat_id) {
    console.error("Failed to bind to chat id; description=" + description);
    if (!this.encounters[combat.data._id])
      this.updateRound(combat);

    let encounter = this.encounters[combat.data._id];
    const turns = in_rounds ? duration * encounter.players : duration;
    encounter.reminder_heap.push({
      'end_turn' : encounter.current_turn + turns,
      'description' : description,
      'chat_id' : chat_id
    });
  }
}
