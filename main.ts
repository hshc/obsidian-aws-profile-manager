import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, SuggestModal  } from 'obsidian';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as profileHandler from 'aws-profile-handler';
// import {Ini, Utils} from 'aws-profile-handler';
const Ini = require('./node_modules/aws-profile-handler/lib/ini');
const Utils = require('./node_modules/aws-profile-handler/lib/utils');


/*
var f = function() {
	this.helloIn = function() {
		alert('helloInF');
	};	
}
f.prototype.hello = function() {
	alert('hello');
}

var g = function(){
	this.helloIn = function() {
		alert('helloInG');
	};
}
g.prototype = new f(); 
g.prototype.coucou = function(){
	alert('coucou'); 
}

var o = new g(); 
o.coucou(); // affiche coucou
o.hello();  // affiche hello
o.helloIn(); // affiche helloInG
o.__proto__.helloIn(); // affiche helloInF
o.coucou = function() {
	alert('coucouOut');	
};
o.coucou(); //affiche coucouOut
// o.prototype.helloIn = function() { // CRAAAAAASHHHHHHHH type(o) != f(), == g
// 	alert('helloInO');
// }
// o.helloIn(); //affiche helloInO
// o.__proto__.helloIn(); //affiche helloIn?

// qd on travaille sur les fonctions ou classes, on reference le prototype avec ".prototype", mais qd on est sur
// l'objet lui meme (cad l'instance de la fonction ou classe), on utilise ".__proto__" pour appeler les fonction des prototypes parents
*/

const defaultFilePath = path.join(os.homedir(), '.aws', 'credentials');
// Remember to rename these classes and interfaces!
function addProfile(profile: string, credentials: Object, filePath ?: string) {
	if (!profile || profile.trim().length === 0) {
		throw new Error('Invalid Input: profile name cannot be omitted nor only contains white spaces.');
	}

	if (!credentials || Object.keys(credentials).length === 0) {
		throw new Error('Invalid Input: credentials cannot be omitted nor empty.');
	}

	if (Object.keys(credentials).length < 3 ||
		!profileHandler.isValidSchema(credentials) &&
		!profileHandler.isValidAltSchema(credentials)) {
		throw new Error('Invalid input: credentials schema is invalid.');
	}

	let credentialPath = filePath || defaultFilePath;
	let profileObject = Ini.decodeIniData(Utils.readFile(credentialPath));

	let outputProfileObject = Utils.deepCopy(profileObject);
	outputProfileObject[profile] = credentials;
	let encodedProfile = Ini.encodeIniFormat(outputProfileObject);
	Utils.writeFile(credentialPath, encodedProfile);

}


interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}
const DEFAULT_PROFILE = 'default';

export function getSortedProfilesCredentials(includeDefaultProfile = true) {

	const credentialsFile = path.join(os.homedir(), '.aws', 'credentials');
	let result = [];

	if (fs.existsSync(credentialsFile)) {

		// listProfile will check if file is valid. If it's not valid,
		// no need to proceed, just callback the error.
		try {
			// if the credential file is empty, CLI will name the first profile as 'default'
			const profiles = profileHandler.listProfiles();

			if (includeDefaultProfile === false) {
				const index = profiles.indexOf(DEFAULT_PROFILE);

				if (index > -1) {
					profiles.splice(index, 1);
				}
			}

			result = profiles.sort();

		} catch (error) {
			console.log(`File '${credentialsFile}' is not valid.`);
			console.log(error);
		}

	}
	else {
		console.log(`File '${credentialsFile}' does not exist.`);
	}

	return result;
}


// export class ExampleModal_1 extends Modal {
// 	result: string;
// 	onSubmit: (result: string) => void;

// 	constructor(app: App, onSubmit: (result: string) => void) {
// 		super(app);
// 		this.onSubmit = onSubmit;
// 	}

// 	onOpen() {
// 		const { contentEl } = this;

// 		contentEl.createEl("h1", { text: "What's your name?" });

// 		new Setting(contentEl)
// 			.setName("Name")
// 			.addText((text) =>
// 				text.onChange((value) => {
// 					this.result = value
// 				}));

// 		new Setting(contentEl)
// 			.addButton((btn) =>
// 				btn
// 					.setButtonText("Submit")
// 					.setCta()
// 					.onClick(() => {
// 						this.close();
// 						this.onSubmit(this.result);
// 					}));
// 	}

// 	onClose() {
// 		let { contentEl } = this;
// 		contentEl.empty();
// 	}
// }

const sortedProfilesCreds = getSortedProfilesCredentials(); 

export class SuggestAwsProfile extends SuggestModal<String> {

	// Returns all available suggestions.
	getSuggestions(query: string): String[] {
		let localsortedProfilesCreds = sortedProfilesCreds;
		let choice = localsortedProfilesCreds.filter((profile: string) =>
			profile.toLowerCase().includes(query.toLowerCase())
		);
		return choice
	}

	// Renders each suggestion item.
	renderSuggestion(profile: string, el: HTMLElement) {
		el.createEl("div", { text: profile });
	}

	// Perform action on the selected suggestion.
	onChooseSuggestion(profile: string, evt: MouseEvent | KeyboardEvent) {
		let profileCreds = profileHandler.getProfileCredentials(profile);
		addProfile("default", profileCreds);
		new Notice(`Selected ${profile} as Default`);
	}
}



export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	async onload() {

		this.addCommand({
			id: "switch profile",
			name: "Switch to AWS profile",
			callback: () => {
				console.log("Hey, you!"+os.homedir());
				new SuggestAwsProfile(this.app).open();
			},
		});

		console.log('loading plugin')
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'AWS Profile Manager', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Hej Bro, make your aws profile choice !');
			new SuggestAwsProfile(this.app).open();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin')
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
