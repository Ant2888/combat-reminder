export default class AboutApp extends FormApplication {
  constructor(options = {}) { super(options); }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id : "combat-reminder-about",
      title : "About Combat Reminder",
      template : "modules/combat-reminder/templates/about.hbs",
      popOut : true,
      width : 500,
      height : 600,
    });
  }

  async getData() {
    return { version: game.modules.get("combat-reminder").data.version }
  }
}
