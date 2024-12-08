import { debug, error, warn } from "../../../lib/utils.js";

export class TrackerPromptMaker {
    /**
     * Constructor for TrackerPromptMaker.
     * @param {Object} existingObject - Optional existing JSON object to prepopulate the component.
     * @param {Function} onTrackerPromptSave - Callback function invoked when the backend object is updated.
     */
    constructor(existingObject = {}, onTrackerPromptSave = () => {}) {
        this.backendObject = {}; // Internal representation of the prompt structure.
        this.onTrackerPromptSave = onTrackerPromptSave; // Save callback.
        this.element = $('<div class="tracker-prompt-maker"></div>'); // Root element of the component.
        this.fieldCounter = 0; // Counter to generate unique field IDs.
        this.exampleCounter = 0; 
        this.init(existingObject); // Initialize the component.
    }

    static get FIELD_TYPES() {
        return {
            STRING: "String",
            ARRAY: "Array",
            OBJECT: "Object",
            FOR_EACH_OBJECT: "For Each Object",
            ARRAY_OBJECT: "Array Object",
        };
    }

    static get NESTING_FIELD_TYPES() {
        return [
            "OBJECT",
            "FOR_EACH_OBJECT",
            "ARRAY_OBJECT",
        ];
    }

    static get FIELD_INCLUDE_OPTIONS() {
        return {
            DYNAMIC: "dynamic",
            STATIC: "static",
            ALL: "all",
        };
    }

    /**
     * Initializes the component by building the UI and populating with existing data if provided.
     * @param {Object} existingObject - Optional existing JSON object.
     */
    init(existingObject) {
        this.buildUI(); // Build the initial UI.
        if (Object.keys(existingObject).length > 0) {
            this.populateFromExistingObject(existingObject); // Prepopulate if data is provided.
        }
    }

    /**
     * Builds the main UI elements of the component.
     */
    buildUI() {
        // Clear existing content in this.element to prevent duplication
        this.element.empty();

        // Container for fields.
        this.fieldsContainer = $('<div class="fields-container"></div>');
        this.element.append(this.fieldsContainer);

        const buttonsWrapper = $('<div class="buttons-wrapper"></div>');

        // Button to add a new field.
        const addFieldBtn = $('<button class="menu_button interactable">Add Field</button>').on("click", () => {
            this.addField(null, null); // Pass null for parentObject and parentFieldId
        });
        buttonsWrapper.append(addFieldBtn);

        // Button to add example values to all fields.
        const addExampleValueBtn = $('<button class="menu_button interactable">Add Example Value</button>').on("click", () => {
            this.addExampleValueToAllFields();
        });
        buttonsWrapper.append(addExampleValueBtn);

        // Button to remove example values from all fields.
        const removeExampleValueBtn = $('<button class="menu_button interactable">Remove Example Value</button>').on("click", () => {
            this.removeExampleValueFromAllFields();
        });
        buttonsWrapper.append(removeExampleValueBtn);

        this.element.append(buttonsWrapper);
    }

    /**
     * Adds a new field to the component.
     * @param {Object|null} parentObject - The parent object in the backendObject where the field should be added.
     * @param {string|null} parentFieldId - ID of the parent field if adding a nested field.
     * @param {Object} fieldData - Optional data to prepopulate the field.
     * @param {string|null} fieldId - Optional field ID to use (maintains consistency when loading existing data).
     * @param {boolean} [isNewField=true] - Flag indicating if the field is new or being loaded from existing data.
     */
    addField(parentObject = null, parentFieldId = null, fieldData = {}, fieldId = null) {
        if (!fieldId) {
            fieldId = `field-${this.fieldCounter++}`; // Generate a unique field ID.
        } else {
            // Ensure fieldCounter is ahead of field IDs
            const idNum = parseInt(fieldId.split("-")[1]);
            if (idNum >= this.fieldCounter) {
                this.fieldCounter = idNum + 1;
            }
        }
    
        if (!fieldData.exampleValues) {
            fieldData.exampleValues = [];
            for (let i = 0; i < this.exampleCounter; i++) {
                fieldData.exampleValues.push("");
            }
        }
    
        const fieldWrapper = $('<div class="field-wrapper"></div>').attr("data-field-id", fieldId);
    
        // Combined div for Field Name, Static/Dynamic Toggle, and Field Type Selector
        const nameDynamicTypeDiv = $('<div class="name-dynamic-type-wrapper"></div>');
    
        // Field Name Input with label
        const fieldNameLabel = $('<label>Field Name:</label>');
        const fieldNameInput = $('<input type="text" class="text_pole" placeholder="Field Name">')
            .val(fieldData.name || "")
            .on("input", (e) => {
                this.validateFieldName(e.target.value, fieldId, parentObject);
                this.syncBackendObject();
            });
        const fieldNameDiv = $('<div class="field-name-wrapper"></div>').append(fieldNameLabel, fieldNameInput);
    
        // Static/Dynamic Toggle with label
        const dynamicInputId = `${fieldId}_isDynamic`;
        const dynamicInput = $(`<input type="checkbox" id="${dynamicInputId}">`)
            .prop("checked", fieldData.isDynamic ?? true)
            .on("change", (e) => {
                this.toggleStaticDynamic(e.target.checked, fieldId, parentObject);
                this.syncBackendObject();
            });
        const staticDynamicToggleLabel = $(`<label for="${dynamicInputId}">Dynamic:</label>`);
        const staticDynamicDiv = $('<div class="static-dynamic-wrapper"></div>').append(staticDynamicToggleLabel, dynamicInput);
    
        // Field Type Selector with label
        const fieldTypeLabel = $('<label>Field Type:</label>');
        const fieldTypeSelector = $(`
            <select>
                ${Object.entries(TrackerPromptMaker.FIELD_TYPES).map(([key, value]) => `<option value="${key}">${value}</option>`).join("")}
            </select>
        `)
            .val(fieldData.type || TrackerPromptMaker.FIELD_TYPES.STRING)
            .on("change", (e) => {
                this.selectFieldType(e.target.value, fieldId, parentObject);
                this.syncBackendObject();
            });
        const fieldTypeDiv = $('<div class="field-type-wrapper"></div>').append(fieldTypeLabel, fieldTypeSelector);
    
        // Append field name, static/dynamic toggle, and field type to the combined div
        nameDynamicTypeDiv.append(fieldNameDiv, staticDynamicDiv, fieldTypeDiv);
    
        // Append the combined div to fieldWrapper
        fieldWrapper.append(nameDynamicTypeDiv);
    
        // Prompt, Default Value, and Example Values Wrapper
        const promptDefaultExampleWrapper = $('<div class="prompt-default-example-wrapper"></div>');
    
        // Prompt Input with label
        const promptLabel = $('<label>Prompt or Note:</label>');
        const promptInput = $('<textarea type="text" class="text_pole" placeholder="Prompt or Note"></textarea>')
            .val(fieldData.prompt || "")
            .on("input", (e) => {
                this.updatePrompt(e.target.value, fieldId, parentObject);
                this.syncBackendObject();
            });
        const promptDiv = $('<div class="prompt-wrapper"></div>').append(promptLabel, promptInput);
    
        // Default and Example Wrapper
        const defaultExampleWrapper = $('<div class="default-example-wrapper"></div>');
    
        // Default Value Input with label
        const defaultValueLabel = $('<label>Default Value:</label>');
        const defaultValueInput = $('<input type="text" class="text_pole" placeholder="Default Value">')
            .val(fieldData.defaultValue || "")
            .on("input", (e) => {
                this.updateDefaultValue(e.target.value, fieldId, parentObject);
                this.syncBackendObject();
            });
        const defaultValueDiv = $('<div class="default-value-wrapper"></div>').append(defaultValueLabel, defaultValueInput);
    
        // Example Values Heading and Container
        const exampleValuesHeading = $('<h4>Example Values:</h4>');
        const exampleValuesContainer = $('<div class="example-values-container"></div>');
    
        // Append default value div, example values heading, and container to defaultExampleWrapper
        defaultExampleWrapper.append(defaultValueDiv, exampleValuesHeading, exampleValuesContainer);
    
        // Append promptDiv and defaultExampleWrapper to promptDefaultExampleWrapper
        promptDefaultExampleWrapper.append(promptDiv, defaultExampleWrapper);
    
        // Append promptDefaultExampleWrapper to fieldWrapper
        fieldWrapper.append(promptDefaultExampleWrapper);
    
        // Nested Fields Container
        const nestedFieldsContainer = $('<div class="nested-fields-container"></div>');
        fieldWrapper.append(nestedFieldsContainer);
    
        const buttonsWrapper = $('<div class="buttons-wrapper"></div>');
    
        // Add Nested Field Button
        const addNestedFieldBtn = $('<button class="menu_button interactable">Add Nested Field</button>')
            .on("click", () => {
                this.addField(parentObject[fieldId].nestedFields, fieldId); // Pass the nestedFields object and fieldId as parentFieldId
                this.syncBackendObject();
            })
            .hide(); // Initially hidden
    
        // Show the button if the field type allows nesting
        if (TrackerPromptMaker.NESTING_FIELD_TYPES.includes(fieldData.type)) {
            addNestedFieldBtn.show();
        }
    
        buttonsWrapper.append(addNestedFieldBtn);
    
        // Remove Field Button
        const removeFieldBtn = $('<button class="menu_button interactable">Remove Field</button>').on("click", () => {
            this.removeField(fieldId, parentObject, fieldWrapper);
            this.syncBackendObject();
        });
        buttonsWrapper.append(removeFieldBtn);
    
        fieldWrapper.append(buttonsWrapper);
    
        // Append fieldWrapper to the DOM
        if (parentFieldId) {
            const parentFieldWrapper = this.element.find(`[data-field-id="${parentFieldId}"] > .nested-fields-container`);
            parentFieldWrapper.append(fieldWrapper);
        } else {
            this.fieldsContainer.append(fieldWrapper);
        }
    
        debug(`Added field with ID: ${fieldId}`);
    
        // Initialize the backend object structure for this field
        if (parentObject) {
            parentObject[fieldId] = {
                name: fieldData.name || "",
                type: fieldData.type || TrackerPromptMaker.FIELD_TYPES.STRING,
                isDynamic: fieldData.isDynamic ?? true,
                prompt: fieldData.prompt || "",
                defaultValue: fieldData.defaultValue || "",
                exampleValues: fieldData.exampleValues ? [...fieldData.exampleValues] : [],
                nestedFields: {},
            };
        } else {
            this.backendObject[fieldId] = {
                name: fieldData.name || "",
                type: fieldData.type || TrackerPromptMaker.FIELD_TYPES.STRING,
                isDynamic: fieldData.isDynamic ?? true,
                prompt: fieldData.prompt || "",
                defaultValue: fieldData.defaultValue || "",
                exampleValues: fieldData.exampleValues ? [...fieldData.exampleValues] : [],
                nestedFields: {},
            };
            parentObject = this.backendObject;
        }
    
        // Add logic to update visibility of "Add Nested Field" button live
        // fieldTypeSelector.on("change", () => {
        //     const isNestingType = TrackerPromptMaker.NESTING_FIELD_TYPES.includes(fieldTypeSelector.val());
        //     addNestedFieldBtn.toggle(isNestingType);
        // });
    
        // Populate example values if any
        if (fieldData.exampleValues && fieldData.exampleValues.length > 0) {
            fieldData.exampleValues.forEach((exampleValue) => {
                this.addExampleValue(fieldId, parentObject, exampleValue, false);
            });
        }
    
        // Recursively build nested fields if any
        if (fieldData.nestedFields && Object.keys(fieldData.nestedFields).length > 0) {
            Object.entries(fieldData.nestedFields).forEach(([nestedFieldId, nestedFieldData]) => {
                this.addField(parentObject[fieldId].nestedFields, fieldId, nestedFieldData, nestedFieldId, false);
            });
        }
    }

    /**
     * Removes a field from the component and backend object.
     * @param {string} fieldId - The ID of the field to remove.
     * @param {Object} parentObject - The parent object containing the field.
     * @param {jQuery} fieldWrapper - The jQuery element of the field wrapper in the UI.
     */
    removeField(fieldId, parentObject, fieldWrapper) {
        // Confirm before removing
        if (confirm("Are you sure you want to remove this field?")) {
            // Remove from backend object
            delete parentObject[fieldId];
            // Remove from UI
            fieldWrapper.remove();
            debug(`Removed field with ID: ${fieldId}`);
            this.syncBackendObject();
        }
    }

    /**
     * Validates the field name to ensure it doesn't contain double quotes.
     * @param {string} name - The field name entered by the user.
     * @param {string} fieldId - The ID of the field being validated.
     * @param {Object} parentObject - The parent object containing the field.
     * @returns {boolean} - True if valid, false otherwise.
     */
    validateFieldName(name, fieldId, parentObject) {
        if (name.includes('"')) {
            warn("Field name cannot contain double quotes.");
            toastr.error("Field name cannot contain double quotes.");
            return false;
        }
        parentObject[fieldId].name = name;
        debug(`Validated field name: ${name}`);
        return true;
    }

    /**
     * Handles the selection of the field type and updates the UI accordingly.
     * @param {string} type - The selected field type.
     * @param {string} fieldId - The ID of the field being updated.
     * @param {Object} parentObject - The parent object containing the field.
     */
    selectFieldType(type, fieldId, parentObject) {
        parentObject[fieldId].type = type;
        debug(`Selected field type: ${type} for field ID: ${fieldId}`);
        const fieldWrapper = this.element.find(`[data-field-id="${fieldId}"]`);
        const addNestedFieldBtn = fieldWrapper.find(".menu_button:contains('Add Nested Field')");
        const isNestingType = TrackerPromptMaker.NESTING_FIELD_TYPES.includes(type);
        addNestedFieldBtn.toggle(isNestingType);
    }

    /**
     * Toggles the field between static and dynamic.
     * @param {boolean} isDynamic - True if dynamic, false if static.
     * @param {string} fieldId - The ID of the field being toggled.
     * @param {Object} parentObject - The parent object containing the field.
     */
    toggleStaticDynamic(isDynamic, fieldId, parentObject) {
        parentObject[fieldId].isDynamic = isDynamic;
        debug(`Toggled static/dynamic to ${isDynamic} for field ID: ${fieldId}`);
    }

    /**
     * Updates the prompt or note for the field.
     * @param {string} promptText - The prompt text entered by the user.
     * @param {string} fieldId - The ID of the field being updated.
     * @param {Object} parentObject - The parent object containing the field.
     */
    updatePrompt(promptText, fieldId, parentObject) {
        parentObject[fieldId].prompt = promptText;
        debug(`Updated prompt for field ID: ${fieldId}`);
    }

    /**
     * Updates the default value for the field.
     * @param {string} defaultValue - The default value entered by the user.
     * @param {string} fieldId - The ID of the field being updated.
     * @param {Object} parentObject - The parent object containing the field.
     */
    updateDefaultValue(defaultValue, fieldId, parentObject) {
        parentObject[fieldId].defaultValue = defaultValue;
        debug(`Updated default value for field ID: ${fieldId}`);
    }

    /**
     * Adds example value inputs to all fields and nested fields.
     */
    addExampleValueToAllFields() {
        // Collect all fields into a flat array
        const allFields = [];

        const collectAllFields = (fields) => {
            Object.keys(fields).forEach((fieldId) => {
                const fieldData = fields[fieldId];
                allFields.push({ fieldId, parentObject: fields });
                if (fieldData.nestedFields && Object.keys(fieldData.nestedFields).length > 0) {
                    collectAllFields(fieldData.nestedFields);
                }
            });
        };

        collectAllFields(this.backendObject);

        // Add an example value to each field
        allFields.forEach(({ fieldId, parentObject }) => {
            this.addExampleValue(fieldId, parentObject);
        });

        this.exampleCounter++;

        debug("Added example values to all fields.");
        this.syncBackendObject(); // Ensure backendObject is updated
    }

    /**
     * Removes the last example value from all fields and nested fields.
     */
    removeExampleValueFromAllFields() {
        // Collect all fields into a flat array
        const allFields = [];

        const collectAllFields = (fields) => {
            Object.keys(fields).forEach((fieldId) => {
                const fieldData = fields[fieldId];
                allFields.push({ fieldId, parentObject: fields });
                if (fieldData.nestedFields && Object.keys(fieldData.nestedFields).length > 0) {
                    collectAllFields(fieldData.nestedFields);
                }
            });
        };

        collectAllFields(this.backendObject);

        // Remove the last example value from each field
        allFields.forEach(({ fieldId, parentObject }) => {
            const fieldData = parentObject[fieldId];
            if (fieldData.exampleValues && fieldData.exampleValues.length > 0) {
                // Remove the last example value
                fieldData.exampleValues.pop();

                // Remove the last input element from the example values container
                const exampleValuesContainer = this.element.find(`[data-field-id="${fieldId}"]>.prompt-default-example-wrapper .example-values-container`);
                exampleValuesContainer.find('input.text_pole').last().remove();

                // Update indices
                this.updateExampleValueIndices(fieldId);
            }
        });

        this.exampleCounter--;

        debug("Removed example values from all fields.");
        this.syncBackendObject();
    }

    /**
     * Adds an example value input to a specific field.
     * @param {string} fieldId - The ID of the field to add the example value to.
     * @param {Object} parentObject - The parent object containing the field.
     * @param {string} exampleValue - Optional initial value for the example value.
     * @param {boolean} [pushToBackend=true] - Whether to push the example value to the backend object.
     */
    addExampleValue(fieldId, parentObject, exampleValue = "", pushToBackend = true) {
        // Example value input
        const exampleValueInput = $('<input class="text_pole" type="text" placeholder="Example Value">')
            .val(exampleValue)
            .on("input", (e) => {
                this.updateExampleValue(fieldId, e.target.value, exampleValueInput.data("index"), parentObject);
                this.syncBackendObject();
            });

        // Assign an index to the example value input
        const index = parentObject[fieldId].exampleValues.length;
        exampleValueInput.data("index", index);

        // Append the exampleValueInput to the example values container
        const exampleValuesContainer = this.element.find(`[data-field-id="${fieldId}"]>.prompt-default-example-wrapper .example-values-container`);
        exampleValuesContainer.append(exampleValueInput);

        // Initialize the example value in the backend object only if pushToBackend is true
        if (pushToBackend) {
            parentObject[fieldId].exampleValues.push(exampleValue);
        }

        this.updateExampleValueIndices(fieldId);
    }

    /**
     * Updates the example value in the backend object.
     * @param {string} fieldId - The ID of the field being updated.
     * @param {string} value - The new example value.
     * @param {number} index - The index of the example value in the array.
     * @param {Object} parentObject - The parent object containing the field.
     */
    updateExampleValue(fieldId, value, index, parentObject) {
        parentObject[fieldId].exampleValues[index] = value;
    }

    /**
     * Updates the indices of all example value inputs for a specific field after removal.
     * @param {string} fieldId - The ID of the field.
     */
    updateExampleValueIndices(fieldId) {
        const exampleValueInputs = this.element.find(`[data-field-id="${fieldId}"]>.prompt-default-example-wrapper .example-values-container input.text_pole`);
        exampleValueInputs.each((i, input) => {
            $(input).data("index", i);
        });
    }

    /**
     * Synchronizes the backend object with the current state of the component.
     */
    syncBackendObject() {
        // Backend object is updated in real-time, so we just log and trigger the save callback.
        debug("Backend object synchronized.");
        this.triggerSaveCallback();
    }

    /**
     * Triggers the save callback function with the current backend object.
     */
    triggerSaveCallback() {
        this.onTrackerPromptSave(this.backendObject);
        debug("Save callback triggered.");
    }

    /**
     * Populates the component with data from an existing object and rebuilds the UI.
     * @param {Object} existingObject - The existing JSON object.
     */
    populateFromExistingObject(existingObject) {
        try {
            // Clear existing backend object and reset field counter
            this.backendObject = {};
            this.fieldCounter = 0;
            this.exampleCounter = 0;

            const collectExampleCount = (obj) => {
                Object.values(obj).forEach((field) => {
                    if (field.exampleValues.length > this.exampleCounter) {
                        this.exampleCounter = field.exampleValues.length;
                    }
                    if (field.nestedFields && Object.keys(field.nestedFields).length > 0) {
                        collectExampleCount(field.nestedFields);
                    }
                });
            };
            collectExampleCount(existingObject);

            const normalizeExampleCount = (obj) => {
                Object.values(obj).forEach((field) => {
                    while (field.exampleValues.length < this.exampleCounter) {
                        field.exampleValues.push("");
                    }
                    if (field.nestedFields && Object.keys(field.nestedFields).length > 0) {
                        normalizeExampleCount(field.nestedFields);
                    }
                });
            }
            normalizeExampleCount(existingObject);

            // Rebuild the UI
            this.buildUI();

            // Build fields from the existing object
            this.buildFieldsFromObject(existingObject, null, null);

            debug("Populated from existing object.");
        } catch (err) {
            error("Error populating from existing object:", err);
            toastr.error("Failed to load data.");
        }
    }

    /**
     * Recursively builds fields from the existing object and updates the UI.
     * @param {Object} obj - The object to build fields from.
     * @param {Object|null} parentObject - The parent object in the backendObject.
     * @param {string|null} parentFieldId - The ID of the parent field if any.
     */
    buildFieldsFromObject(obj, parentObject, parentFieldId = null) {
        Object.entries(obj).forEach(([fieldId, fieldData]) => {
            // Use the appropriate parent object
            const currentParentObject = parentObject ? parentObject : this.backendObject;
            // Add the field (isNewField = false because we're loading existing data)
            this.addField(currentParentObject, parentFieldId, fieldData, fieldId, false);
        });
    }

    /**
     * Returns the root HTML element of the component for embedding.
     * @returns {jQuery} - The root element of the component.
     */
    getElement() {
        return this.element;
    }
}