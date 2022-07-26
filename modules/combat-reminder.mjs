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

    const cls = ChatMessage.implementation;
    if (!cls) {
      alert(to_fire.description ?? "something happened (lost details)");
    }

    const random_phrases = [
      "Time's up!",
      "Hey, just reminding you!",
      "I thought you should know...",
      "Grondor grondor!",
      "SMASHING!",
      "**traveler nods silently**",
      "Time for some more wild magic?",
    ];

    let chatData = {
      'type' : CONST.CHAT_MESSAGE_TYPES.OOC,
      'user' : game.userId
    };
    chatData.content =
        random_phrases[Math.floor(Math.random() * random_phrases.length)] +
        "<br><br>It's been: " + to_fire.round_text +
        "<hr><i>Reminder Text</i><blockquote>" + to_fire.description +
        "</blockquote>";
    chatData.speaker = {
      'actor' : null,
      'alias' : "RemindMe!",
      'scene' : game.combat?.data.scene,
      'token' : null
    };
    cls.create(chatData, {});
  }

  // Resets round counts to 0, optionally firing the alerts.
  resetData(combat_data, fire_alerts = false) {
    if (!combat_data)
      return;

    let encounter = this.encounters[combat_data._id];
    if (!encounter)
      return;

    if (fire_alerts) {
      while (encounter.reminder_heap.size() > 0) {
        this.fireAlert(encounter.reminder_heap.pop());
      }
    }
    delete this.encounters[combat_data._id];
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
            new Heap((a, b) => { return a.end_turn - b.end_turn; }),
        'combat_id' : combat.data._id
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

  // Dequeuing is really slow, technically n^2lgn due to arbitrarily pulling out
  // N elements from a heap, while keeping it sorted.
  //
  // A good heap implementation can actually do this in nlgn but this can not
  // :).
  dequeReminderById(message) {
    if (message?.alias !== "RemindMe!" || !message.data)
      return;

    for (var property in this.encounters) {
      var indexToDeque =
          this.encounters[property].reminder_heap.nodes.findIndex(
              node => node.chat_id === message.data._id);
      if (indexToDeque !== -1) {
        this.encounters[property].reminder_heap.nodes.splice(indexToDeque);
        this.encounters[property].reminder_heap.heapify();
        break;
      }
    }
  }

  queueReminder(combat, duration, trigger_time, in_rounds, description,
                chat_id) {
    if (!chat_id) {
      console.error("Failed to bind to chat id; description=" + description);
    }
    if (!this.encounters[combat.data._id])
      this.updateRound(combat);

    let encounter = this.encounters[combat.data._id];
    let turns = in_rounds ? duration * encounter.players : duration;
    if (trigger_time === "end")
      turns++;
    encounter.reminder_heap.push({
      'end_turn' : encounter.current_turn + turns,
      'description' : description,
      'chat_id' : chat_id,
      'round_text' : "" + duration + (in_rounds ? " round(s)" : " turn(s)")
    });
  }
}
