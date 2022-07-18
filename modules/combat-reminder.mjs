import {kTemplatePath} from "./config.mjs";

export default class CombatReminder extends Application {
  constructor(options = {}) {
    super(options);

    this.players = 0;
    this.current_turn = 0;
    this.reminders =
        new Heap(function(a, b) { return b.end_turn - a.end_turn; });
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
    if (to_fire === undefined || to_fire === null)
      return;

    alert(to_fire.description ?? "something happened (lost details)");
  }

  // Resets round counts to 0, optionally firing the alerts.
  resetData(fire_alerts = false) {
    this.players = 0;
    this.current_turn = 0;
    if (!fire_alerts) {
      this.reminders =
          new Heap(function(a, b) { return b.end_turn - a.end_turn; });
      return;
    }

    while (this.reminders.size() > 0) {
      this.fireAlert(this.reminders.pop());
    }
  }

  // Advances the current round of combat, firing any alerts.
  updateRound(round, turn, players) {
    // If the # of players change, we need to normalize the rounds.
    if (this.players != players) {
      this.reminders.toArray().forEach(function(elem) {
        const {round, turn} = CombatReminder.orderFromCumulativeTurns(
            this.players, elem.end_turn);
        elem.end_turn =
            CombatReminder.cumulativeTurnsFromOrder(round, turn, players);
      });

      const {round, turn} = CombatReminder.orderFromCumulativeTurns(
          this.players, this.current_turn);
      this.current_turn =
          CombatReminder.cumulativeTurnsFromOrder(round, turn, this.players);

      this.players = players;
      this.reminders.heapify();
    }

    while (this.reminders.size() > 0 &&
           this.reminders.peek().end_turn <=
               CombatReminder.cumulativeTurnsFromOrder(round, turn, players)) {
      this.fireAlert(this.reminders.pop());
    }
  }

  queueReminder(duration, in_rounds, description) {
    const turns = in_rounds ? duration * this.players : duration;
    this.reminders.push(
        {'end_turn' : this.current_turn + turns, 'description' : description});
  }
}
