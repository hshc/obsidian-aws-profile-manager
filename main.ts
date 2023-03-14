import { App, Editor, MarkdownView, Modal, Notice, addIcon, setIcon, Plugin, PluginSettingTab, Setting, SuggestModal } from 'obsidian';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as profileHandler from 'aws-profile-handler';
// import {Ini, Utils} from 'aws-profile-handler';

interface AwsProfileManagerSettings {
	mySetting: string;
}

const Ini = require('./node_modules/aws-profile-handler/lib/ini');
const Utils = require('./node_modules/aws-profile-handler/lib/utils');
const defaultFilePath = path.join(os.homedir(), '.aws', 'credentials');
const DEFAULT_SETTINGS: AwsProfileManagerSettings = {
	mySetting: 'default'
}
const DEFAULT_PROFILE = 'default';

// add a profile in the .aws/credentials file
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



// list and order in an array all the profiles that are available in the .aws/credentials file
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

const sortedProfilesCreds = getSortedProfilesCredentials(false); 
const originProfile = (<Record<string,string>>profileHandler.getProfileCredentials(DEFAULT_PROFILE))?.originProfile;

export class SuggestAwsProfileModal extends SuggestModal<String> {

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
		let profileCreds = <Record<string,string>>profileHandler.getProfileCredentials(profile);
		profileCreds["originProfile"] = profile;
		addProfile("default", profileCreds);
		new Notice(`New default profile is '${profile}'`);
		let items = document.getElementsByClassName("status-bar-item plugin-obsidian-aws-profile-manager");
		items[0].innerHTML = "";
		items[0].createEl("span", { text: "🎭" });
		items[0].createEl("span", { text: profile });
	}
}

export default class AwsProfileManagerPlugin extends Plugin {
	settings: AwsProfileManagerSettings;
	statusBarItemEl: HTMLElement;

	async onload() {
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const item = this.addStatusBarItem();
		item.createEl("span", { text: "🎭" });
		if (originProfile == null) {
			item.createEl("span", { text: "Choose a profile" });
		} else {
			item.createEl("span", { text: originProfile });
		}

		this.addCommand({
			id: "switch profile",
			name: "Switch to AWS profile",
			callback: () => {
				console.log("Hey, you! "+os.homedir());
				new SuggestAwsProfileModal(this.app).open();
			},
			
		});

		await this.loadSettings();

		// This creates an icon in the left ribbon.
		addIcon("aws", '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 455 455" fill="#FFFFFF" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path style="fill-rule:evenodd;clip-rule:evenodd;" d="M235.916,190.817c-10.274,0.966-32.834,4.09-43.941,13.309c-14.653,12.159-20.575,52.996,11.215,52.996c4.959,0,9.285-0.5,13.073-1.346c14.641-3.251,24.968-16.399,24.968-31.399v-28.722C241.231,192.791,238.768,190.545,235.916,190.817z"/><path d="M0,0v455h455V0H0z M215.655,111.854c-19.068,0-31.26,20.675-35.458,29.166c-1.041,2.116-3.351,3.277-5.673,2.885l-38.255-6.464c-3.168-0.53-5.173-3.698-4.251-6.778c4.815-16.085,23.591-59.949,85.197-59.949c75.437,0,82.607,48.625,82.607,60.468v98.509c0,0-0.314,8.416,7.169,19.015c2.399,3.382,4.34,6.073,5.878,8.155c2.649,3.59,2.202,8.58-1.03,11.659l-27.895,26.576c-3.288,3.113-8.408,3.285-11.845,0.336c-3.557-3.049-7.95-7.116-11.237-11.196c-3.068-3.796-5.445-7.244-7.114-9.846c-1.369-2.127-4.415-2.224-5.923-0.208c-6.736,9.091-24.893,28.45-57.097,28.45c-42.084,0-70.134-33.981-70.134-63.278c0-29.305,18.701-66.716,59.224-75.132c28.439-5.9,46.898-5.673,55.381-5.001c2.929,0.228,5.401-2.094,5.401-5.023v-22.7C240.601,131.499,239.668,111.865,215.655,111.854z M319.162,358.74c-24.632,13.711-48.637,25.546-105.667,25.546c-69.298,0-124.701-44.091-135.6-57.497c-10.912-13.409-7.333-20.262-7.333-20.262s4.207-8.266,16.052,0c11.845,8.252,67.335,47.226,122.51,47.226c55.176,0,93.508-14.655,105.981-19.959c12.462-5.292,26.498-11.92,29.927-5.49C348.459,334.739,343.783,345.021,319.162,358.74z M354.142,359.132c-7.267-3.937,0.239-11.931,3.274-21.508c3.038-9.588,4.676-18.004,0-22.127c-4.673-4.132-11.454-2.191-26.887-0.325c-15.424,1.877-14.492-5.143-14.492-5.143s0-2.796,3.504-5.14c3.504-2.333,50.891-21.9,62.192-4.437C395.326,321.452,362.634,363.73,354.142,359.132z"/>');

		const ribbonIconEl = this.addRibbonIcon('aws', 'AWS Profile Manager', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Hej Bro '+os.homedir()+', make your aws profile choice !');
			new SuggestAwsProfileModal(this.app).open();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');


		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AwsProfileManagerSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class AwsProfileManagerSettingTab extends PluginSettingTab {
	plugin: AwsProfileManagerPlugin;

	constructor(app: App, plugin: AwsProfileManagerPlugin) {
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
