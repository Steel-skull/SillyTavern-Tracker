import { chat } from "../../../../../script.js";
import { is_group_generating } from "../../../../../scripts/group-chats.js";
import { getLastNonSystemMessageIndex, log } from "../lib/utils.js";
import { debug, getLastNonSystemMessageIndex, log } from "../lib/utils.js";
import { isEnabled } from "./settings/settings.js";
import { prepareMessageGeneration, addTrackerToMessage, clearInjects } from "./tracker.js";
import { releaseGeneration } from "../lib/interconnection.js";
import { FIELD_INCLUDE_OPTIONS, getTracker, OUTPUT_FORMATS, saveTracker } from "./trackerDataHandler.js";
import { TrackerInterface } from "./ui/trackerInterface.js";
import { extensionSettings } from "../index.js";
import { TrackerPreviewManager } from "./ui/trackerPreviewManager.js";

/**
 * Event handler for when the chat changes.
 * @param {object} args - The event arguments.
 */
async function onChatChanged(args) {
	if (!await isEnabled()) return;
	log("Chat changed:", args);
	updateTrackerUI();
	//TrackerPreviewManager.init();
	releaseGeneration();
}

/**
 * Event handler for after generation commands.
 * @param {string} type - The type of generation.
 * @param {object} options - Generation options.
 * @param {boolean} dryRun - Whether it's a dry run.
 */
async function onGenerateAfterCommands(type, options, dryRun) {
	await clearInjects();
	if (!await isEnabled() || chat.length == 0 || is_group_generating || (typeof type != "undefined" && !["continue", "swipe", "regenerate", "impersonate"].includes(type))) return;
	log("GENERATION_AFTER_COMMANDS ", [type, options, dryRun]);
	await prepareMessageGeneration(type, options, dryRun);
	releaseGeneration();
}

/**
 * Event handler for when a message is received.
 * @param {number} mesId - The message ID.
 */
async function onMessageReceived(mesId) {
	if (!await isEnabled() || !chat[mesId] || (chat[mesId].tracker && Object.keys(chat[mesId].tracker).length !== 0)) return;
	log("MESSAGE_RECEIVED", mesId);
	await addTrackerToMessage(mesId);
	releaseGeneration();
}

/**
 * Event handler for when a message is sent.
 * @param {number} mesId - The message ID.
 */
async function onMessageSent(mesId) {
	if (!await isEnabled() || !chat[mesId] || (chat[mesId].tracker && Object.keys(chat[mesId].tracker).length !== 0)) return;
	log("MESSAGE_SENT", mesId);
	await addTrackerToMessage(mesId);
	releaseGeneration();
}

/**
 * Event handler for when a character's message is rendered.
 */
async function onCharacterMessageRendered(mesId) {
	if (!await isEnabled() || !chat[mesId] || (chat[mesId].tracker && Object.keys(chat[mesId].tracker).length !== 0)) return;
	log("CHARACTER_MESSAGE_RENDERED");
	await addTrackerToMessage(mesId);
	releaseGeneration();
	updateTrackerUI();
}

/**
 * Event handler for when a user's message is rendered.
 */
async function onUserMessageRendered(mesId) {
	if (!await isEnabled() || !chat[mesId] || (chat[mesId].tracker && Object.keys(chat[mesId].tracker).length !== 0)) return;
	log("USER_MESSAGE_RENDERED");
	await addTrackerToMessage(mesId);
	releaseGeneration();
	updateTrackerUI();
}

async function generateAfterCombinePrompts(prompt) {
	debug("GENERATE_AFTER_COMBINE_PROMPTS", {prompt});
}

export const eventHandlers = {
	onChatChanged,
	onGenerateAfterCommands,
	onMessageReceived,
	onMessageSent,
	onCharacterMessageRendered,
	onUserMessageRendered,
	generateAfterCombinePrompts
};

function updateTrackerUI() {
	const lastMesId = getLastNonSystemMessageIndex();
	const tracker = chat[lastMesId]?.tracker ?? {};
	if(Object.keys(tracker).length === 0) return;
	const trackerData = getTracker(tracker, extensionSettings.trackerDef, FIELD_INCLUDE_OPTIONS.ALL, false, OUTPUT_FORMATS.JSON); // Get tracker data for the last message
	const onSave = (updatedTracker) => {
		saveTracker(updatedTracker, extensionSettings.trackerDef, lastMesId);
	};
	const trackerInterface = new TrackerInterface();
	trackerInterface.init(trackerData, lastMesId, onSave);
}