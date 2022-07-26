import AboutApp from "./about.mjs";
import CombatReminder from "./combat-reminder.mjs";
import {kModuleName} from "./config.mjs";

export default function registerReminderHooks() {
  Hooks.on("init", () => {
    game.settings.registerMenu(kModuleName, "about", {
      name : "Combat Reminder",
      label : "About This Module",
      hint : "About",
      icon : "fas fa-bars",
      type : AboutApp,
      restricted : false
    });
  });

  Hooks.on("ready", () => { CombatReminder.appReady(); });

  Hooks.on("deleteCombat", async (combat, options, userId) => {
    if (!ui.combatReminder || !combat?.data)
      return;

    ui.combatReminder.resetData(combat?.data, true);
  });

  Hooks.on("updateCombat", (combat, update, options, userId) => {
    if (!ui.combatReminder || !combat?.data)
      return;

    ui.combatReminder.updateRound(combat);
  });

  Hooks.on("deleteChatMessage",
           (message, options,
            id) => { ui.combatReminder.dequeReminderById(message); });

  Hooks.on("chatMessage", (chatLog, message, chatData, user, speaker) => {
    // The syntax for a reminder is:
    //   /remindme <duration> [-t <begin|end>] [-r] <description>
    //
    //     -t <begin|end>: When to trigger the alert, either at the 'begin'ning
    //                     or the 'end' of the turn.
    //     -r: Whether the alert should go to the nearest round (not the
    //         player).
    //
    //   Duration can be of the form:
    //     1t or 1turn
    //     1r or 1round
    //
    //   By default -t is end and -r is false.
    //
    // E.g.
    //   /remindme 10r "Grondor's Potion of Str. runs out."
    message = message.replace(/\n/g, "<br>");
    message = message.split(" ");
    let index = 0;
    if (!message.length || message[index++].toLowerCase() !== "/remindme")
      return true;
    if (message.length < 3) {
      console.error("Remindme syntax expects at least 2 other args!");
      return false;
    }

    let duration_match = message[index++].toLowerCase().match(
        new RegExp("^(\\d+)(r(?:ounds?)?|t(?:urns?)?)$", 'i'));
    if (!duration_match || duration_match.length < 3) {
      console.error("Remindme syntax error; syntax is /remindme" +
                    " <duration> [-t <begin|end>] [-r] <description>");
      return false;
    }

    let trigger = "end";
    if (message[index].toLowerCase() === "-t") {
      if (message.length < 5) {
        console.error("Remindme syntax error; syntax is /remindme" +
                      " <duration> [-t <begin|end>] [-r] <description>");
        return false;
      }

      const trigger_time = message[++index].toLowerCase();
      if (trigger_time === "begin") {
        trigger = "begin";
      } else if (trigger_time !== "end") {
        console.error("Remindme syntax error; syntax is /remindme" +
                      " <duration> [-t <begin|end>] [-r] <description>");
        return false;
      }
      index++;
    }

    let should_round = false;
    if (message[index].toLowerCase() === "-r") {
      if (message.length <= ++index) {
        console.error("Remindme syntax error; syntax is /remindme" +
                      " <duration> [-t <begin|end>] [-r] <description>");
        return false;
      }
      should_round = true;
    }

    if (message.length <= index) {
      console.error("Remindme syntax error; syntax is /remindme" +
                    " <duration> [-t <begin|end>] [-r] <description>");
      return false;
    }
    if (!ui.combatReminder) {
      console.error("Remindme hasn't initialized yet.");
      return false;
    }
    if (!game.combat) {
      console.error("Remindme: not in combat!");
      return false;
    }
    if (game.combat.current.round === null) {
      console.error("Remindme: combat not started!");
      return false;
    }

    let description = message.slice(index, message.length).join(" ");
    chatData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
    chatData.speaker.alias = "RemindMe!";
    chatData.content = "<blockquote>" + description + "</blockquote>" +
                       "<hr>Reminding you in: " + duration_match[1] +
                       (duration_match[2][0] == 'r' ? " round(s)" : " turn(s)");

    const cls = ChatMessage.implementation;
    cls.create(chatData, {}).then((chat_msg) => {
      ui.combatReminder.queueReminder(game.combat, parseInt(duration_match[1]),
                                      trigger, duration_match[2][0] === 'r',
                                      description, chat_msg?.data?._id);
    });
    return false;
  });
}
