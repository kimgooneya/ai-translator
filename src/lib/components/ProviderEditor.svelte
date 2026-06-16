<script lang="ts">
	import { UI } from "$lib/constants/ui-strings";
	import type { Provider, ProviderConfig } from "$lib/schemas";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";

	let {
		mode,
		provider,
		config,
		unconfiguredPresets,
		onsave,
		ondelete,
		oncancel,
	}: {
		mode: "edit" | "new";
		provider: Provider | undefined;
		config: ProviderConfig | undefined;
		unconfiguredPresets: Provider[];
		onsave: (config: ProviderConfig, isNew: boolean) => void;
		ondelete?: (providerId: string) => void;
		oncancel: () => void;
	} = $props();

	// Picker choice in 'new' mode: which sub-form to show.
	let pickerChoice = $state<"preset" | "custom" | "openai-compat" | null>(null);

	// Shared form state. Re-seeded whenever the form key (mode + provider id +
	// picker choice) changes, mirroring the old AddProviderModal/EditProviderDrawer
	// $effect/untrack patterns so editing different providers re-initializes.
	let apiKey = $state("");
	let selectedModel = $state("");
	let pickedPresetId = $state("");
	let name = $state("");
	let baseURL = $state("");
	let modelsInput = $state("");
	let defaultModel = $state("");

	let models = $derived(
		modelsInput
			.split(",")
			.map((m) => m.trim())
			.filter((m) => m !== ""),
	);

	let pickedPreset = $derived(
		pickedPresetId
			? (unconfiguredPresets.find((p) => p.id === pickedPresetId) ?? undefined)
			: undefined,
	);

	// The entry key determines when local form state must be re-seeded. It
	// captures the form context (mode + which provider), NOT the picker choice.
	// On every context change we reset the picker (new mode) and re-seed fields,
	// mirroring the old AddProviderModal/EditProviderDrawer $effect/untrack
	// patterns so editing different providers re-initializes the form.
	let lastEntryKey = $state("");
	$effect(() => {
		const entryKey = `${mode}:${provider?.id ?? ""}`;
		if (entryKey === lastEntryKey) return;
		lastEntryKey = entryKey;
		pickerChoice = null;
		seedFields();
	});

	function seedFields(): void {
		if (mode === "edit" && provider) {
			apiKey = config?.apiKey ?? "";
			selectedModel = config?.selectedModel ?? provider.defaultModel;
			name = provider.name;
			baseURL = provider.baseURL;
			modelsInput = provider.models.join(", ");
			defaultModel = provider.defaultModel;
			pickedPresetId = "";
		} else if (mode === "new") {
			apiKey = "";
			selectedModel = "";
			name = "";
			baseURL = "";
			modelsInput = "";
			defaultModel = "";
			pickedPresetId = "";
		}
	}

	// Keep defaultModel in sync with the parsed models list (mirrors old
	// AddProviderModal lastModelsKey pattern).
	let lastModelsKey = $state("");
	$effect(() => {
		const key = models.join("|");
		if (key === lastModelsKey) return;
		lastModelsKey = key;
		if (models.length === 0) {
			defaultModel = "";
		} else if (!models.includes(defaultModel)) {
			defaultModel = models[0];
		}
	});

	// When a preset is picked in new mode, default the model to that preset's
	// default. Reads pickedPreset (not selectedModel) so it does not fight the
	// user's manual model-select choice.
	$effect(() => {
		if (mode === "new" && pickerChoice === "preset" && pickedPreset) {
			selectedModel = pickedPreset.defaultModel;
		}
	});

	// When the OpenAI-compatible template is picked in new mode, pre-fill the
	// custom form with sensible OpenAI defaults so the user only has to type
	// their compatible baseURL (and API key). Fires once per pickerChoice
	// transition into "openai-compat": it reads only mode + pickerChoice, so
	// the field writes below do not re-trigger it. baseURL is intentionally
	// left empty — the whole point of this template is user-supplied URL.
	$effect(() => {
		if (mode === "new" && pickerChoice === "openai-compat") {
			name = "OpenAI 호환";
			baseURL = "";
			modelsInput = "gpt-5.4, gpt-5.4-mini";
			defaultModel = "gpt-5.4-mini";
			selectedModel = "gpt-5.4-mini";
			apiKey = "";
		}
	});

	function isValidUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}

	let errors = $derived({
		name: name.trim() === "" ? UI.SETTINGS_PAGE.ERROR_NAME_REQUIRED : undefined,
		baseURL:
			baseURL.trim() === ""
				? UI.SETTINGS_PAGE.ERROR_BASE_URL_REQUIRED
				: !isValidUrl(baseURL.trim())
					? UI.SETTINGS_PAGE.ERROR_BASE_URL_INVALID
					: undefined,
		models:
			models.length === 0 ? UI.SETTINGS_PAGE.ERROR_MODELS_REQUIRED : undefined,
	});

	let isCustomFormValid = $derived(
		errors.name === undefined &&
			errors.baseURL === undefined &&
			errors.models === undefined,
	);

	// --- Dirty / save-enabled flags per mode ---
	let isPresetEditDirty = $derived(
		mode === "edit" &&
			provider?.kind === "preset" &&
			(apiKey !== (config?.apiKey ?? "") ||
				selectedModel !==
					(config?.selectedModel ?? provider?.defaultModel ?? "")),
	);

	let isCustomEditDirty = $derived(
		mode === "edit" &&
			provider?.kind === "custom" &&
			(name !== (provider?.name ?? "") ||
				baseURL !== (provider?.baseURL ?? "") ||
				modelsInput !== (provider?.models.join(", ") ?? "") ||
				apiKey !== (config?.apiKey ?? "") ||
				defaultModel !== (provider?.defaultModel ?? "")),
	);

	let isNewPresetReady = $derived(
		mode === "new" &&
			pickerChoice === "preset" &&
			pickedPresetId !== "" &&
			apiKey.trim() !== "",
	);

	let isNewCustomReady = $derived(
		mode === "new" &&
			(pickerChoice === "custom" || pickerChoice === "openai-compat") &&
			isCustomFormValid,
	);

	let canSave = $derived(
		isPresetEditDirty ||
			(isCustomEditDirty && isCustomFormValid) ||
			isNewPresetReady ||
			isNewCustomReady,
	);

	let defaultModelTriggerText = $derived(
		models.length === 0
			? UI.SETTINGS_PAGE.DEFAULT_MODEL_PLACEHOLDER
			: defaultModel || UI.SETTINGS_PAGE.DEFAULT_MODEL_PLACEHOLDER,
	);

	let presetSelectTriggerText = $derived(
		pickedPreset
			? pickedPreset.name
			: UI.SETTINGS_PAGE.PRESET_SELECT_PLACEHOLDER,
	);

	let isEmptyState = $derived(mode === "edit" && provider === undefined);
	let isPresetEdit = $derived(mode === "edit" && provider?.kind === "preset");
	let isCustomEdit = $derived(mode === "edit" && provider?.kind === "custom");

	function handleSavePresetEdit(): void {
		if (!provider) return;
		onsave(
			{
				providerId: provider.id,
				apiKey: apiKey.trim(),
				selectedModel,
			},
			false,
		);
	}

	function handleSaveCustomEdit(): void {
		if (!provider) return;
		onsave(
			{
				providerId: provider.id,
				apiKey: apiKey.trim(),
				selectedModel: defaultModel,
				baseURL: baseURL.trim(),
				name: name.trim(),
				models: [...models],
				defaultModel,
			},
			false,
		);
	}

	function handleSaveNewPreset(): void {
		if (!pickedPreset) return;
		onsave(
			{
				providerId: pickedPreset.id,
				apiKey: apiKey.trim(),
				selectedModel,
			},
			true,
		);
	}

	function handleSaveNewCustom(): void {
		const providerId = "custom-" + crypto.randomUUID();
		onsave(
			{
				providerId,
				apiKey: apiKey.trim(),
				selectedModel: defaultModel,
				baseURL: baseURL.trim(),
				name: name.trim(),
				models: [...models],
				defaultModel,
			},
			true,
		);
	}

	function handleSave(): void {
		if (isPresetEdit) handleSavePresetEdit();
		else if (isCustomEdit) handleSaveCustomEdit();
		else if (isNewPresetReady) handleSaveNewPreset();
		else if (isNewCustomReady) handleSaveNewCustom();
	}

	function handleDelete(): void {
		if (!provider) return;
		if (window.confirm(UI.SETTINGS_PAGE.CONFIRM_DELETE)) {
			ondelete?.(provider.id);
		}
	}
</script>

{#if isEmptyState}
	<div
		data-testid="editor-empty"
		class="flex h-full flex-col items-center justify-center gap-2 border rounded-lg bg-card p-8 text-center"
	>
		<p class="text-lg font-medium text-foreground">
			{UI.SETTINGS_PAGE.EDITOR_EMPTY_TITLE}
		</p>
		<p class="max-w-sm text-sm text-muted-foreground">
			{UI.SETTINGS_PAGE.EDITOR_EMPTY_DESC}
		</p>
	</div>
{:else if mode === "new" && pickerChoice === null}
	<div
		data-testid="editor-picker"
		class="flex h-full flex-col gap-4 border rounded-lg bg-card p-6"
	>
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-lg font-semibold text-foreground">
				{UI.SETTINGS_PAGE.EDITOR_PICKER_PROMPT}
			</h2>
			<Button
				data-testid="cancel-button"
				variant="ghost"
				size="sm"
				onclick={() => oncancel()}
			>
				{UI.SETTINGS_PAGE.BUTTON_CANCEL}
			</Button>
		</div>
		<div class="flex flex-col gap-3">
			<button
				data-testid="preset-option"
				type="button"
				onclick={() => (pickerChoice = "preset")}
				class="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
			>
				<div class="flex flex-col gap-0.5">
					<span class="font-medium text-foreground">
						{UI.SETTINGS_PAGE.EDITOR_PRESET_OPTION}
					</span>
					<span class="text-xs text-muted-foreground">
						{UI.SETTINGS_PAGE.EDITOR_PRESET_DESC}
					</span>
				</div>
			</button>
			<button
				data-testid="openai-compat-option"
				type="button"
				onclick={() => (pickerChoice = "openai-compat")}
				class="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
			>
				<div class="flex flex-col gap-0.5">
					<span class="font-medium text-foreground">
						{UI.SETTINGS_PAGE.EDITOR_OPENAI_COMPAT_OPTION}
					</span>
					<span class="text-xs text-muted-foreground">
						{UI.SETTINGS_PAGE.EDITOR_OPENAI_COMPAT_DESC}
					</span>
				</div>
			</button>
			<button
				data-testid="custom-option"
				type="button"
				onclick={() => (pickerChoice = "custom")}
				class="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
			>
				<div class="flex flex-col gap-0.5">
					<span class="font-medium text-foreground">
						{UI.SETTINGS_PAGE.EDITOR_CUSTOM_OPTION}
					</span>
					<span class="text-xs text-muted-foreground">
						{UI.SETTINGS_PAGE.EDITOR_CUSTOM_DESC}
					</span>
				</div>
			</button>
		</div>
	</div>
{:else}
	<div
		data-testid="provider-editor-form"
		class="flex h-full flex-col gap-4 border rounded-lg bg-card p-6"
	>
		<!-- Header: title + cancel (new mode) -->
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-lg font-semibold text-foreground">
				{mode === "new"
					? UI.SETTINGS_PAGE.ADD_PROVIDER_TITLE
					: `${UI.SETTINGS_PAGE.EDIT_PROVIDER_TITLE}: ${provider?.name ?? ""}`}
			</h2>
			{#if mode === "new"}
				<Button
					data-testid="cancel-button"
					variant="ghost"
					size="sm"
					onclick={() => oncancel()}
				>
					{UI.SETTINGS_PAGE.BUTTON_CANCEL}
				</Button>
			{/if}
		</div>

		<!-- NEW preset picker sub-form -->
		{#if mode === "new" && pickerChoice === "preset"}
			<div class="flex flex-col gap-2">
				<Label for="preset-select"
					>{UI.SETTINGS_PAGE.PRESET_SELECT_PLACEHOLDER}</Label
				>
				{#if unconfiguredPresets.length === 0}
					<p class="text-sm text-muted-foreground">
						{UI.SETTINGS_PAGE.NO_UNCONFIGURED_PRESETS}
					</p>
				{:else}
					<Select.Root type="single" bind:value={pickedPresetId}>
						<Select.Trigger
							id="preset-select"
							data-testid="preset-select"
							class="w-full"
						>
							{presetSelectTriggerText}
						</Select.Trigger>
						<Select.Content>
							{#each unconfiguredPresets as preset (preset.id)}
								<Select.Item value={preset.id} label={preset.name}>
									{preset.name}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{/if}
			</div>

			{#if pickedPreset}
				<div class="flex flex-col gap-2">
					<Label for="new-preset-api-key"
						>{UI.SETTINGS_PAGE.API_KEY_LABEL}</Label
					>
					<Input
						id="new-preset-api-key"
						type="password"
						data-testid="api-key-input"
						placeholder={UI.SETTINGS_PAGE.API_KEY_PLACEHOLDER}
						autocomplete="off"
						bind:value={apiKey}
					/>
				</div>

				<div class="flex flex-col gap-2">
					<Label for="new-preset-model">{UI.SETTINGS_PAGE.MODEL_LABEL}</Label>
					<Select.Root type="single" bind:value={selectedModel}>
						<Select.Trigger
							id="new-preset-model"
							data-testid="model-select"
							class="w-full"
						>
							{selectedModel || pickedPreset.defaultModel}
						</Select.Trigger>
						<Select.Content>
							{#each pickedPreset.models as model (model)}
								<Select.Item value={model} label={model}>{model}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}
		{:else if isPresetEdit}
			<!-- EDIT preset: API key + model only -->
			<div class="flex flex-col gap-2">
				<Label for="edit-api-key">{UI.SETTINGS_PAGE.API_KEY_LABEL}</Label>
				<Input
					id="edit-api-key"
					type="password"
					data-testid="api-key-input"
					placeholder={UI.SETTINGS_PAGE.API_KEY_PLACEHOLDER}
					autocomplete="off"
					bind:value={apiKey}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="edit-model">{UI.SETTINGS_PAGE.MODEL_LABEL}</Label>
				{#if provider}
					<Select.Root type="single" bind:value={selectedModel}>
						<Select.Trigger
							id="edit-model"
							data-testid="model-select"
							class="w-full"
						>
							{selectedModel}
						</Select.Trigger>
						<Select.Content>
							{#each provider.models as model (model)}
								<Select.Item value={model} label={model}>{model}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{/if}
			</div>
		{:else if isCustomEdit || (mode === "new" && (pickerChoice === "custom" || pickerChoice === "openai-compat"))}
			<!-- EDIT custom / NEW custom: full definition form -->
			<div class="flex flex-col gap-2">
				<Label for="custom-name">{UI.SETTINGS_PAGE.PROVIDER_NAME}</Label>
				<Input
					id="custom-name"
					type="text"
					data-testid="name-input"
					aria-invalid={errors.name ? "true" : undefined}
					bind:value={name}
				/>
				{#if errors.name}
					<p data-testid="error-name" class="text-xs text-destructive">
						{errors.name}
					</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<Label for="custom-base-url">{UI.SETTINGS_PAGE.PROVIDER_BASE_URL}</Label
				>
				<Input
					id="custom-base-url"
					type="url"
					placeholder="https://api.example.com/v1"
					data-testid="base-url-input"
					aria-invalid={errors.baseURL ? "true" : undefined}
					bind:value={baseURL}
				/>
				{#if errors.baseURL}
					<p data-testid="error-base-url" class="text-xs text-destructive">
						{errors.baseURL}
					</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<Label for="custom-models">{UI.SETTINGS_PAGE.PROVIDER_MODELS}</Label>
				<Input
					id="custom-models"
					type="text"
					placeholder="model-1, model-2"
					data-testid="models-input"
					aria-invalid={errors.models ? "true" : undefined}
					bind:value={modelsInput}
				/>
				{#if errors.models}
					<p data-testid="error-models" class="text-xs text-destructive">
						{errors.models}
					</p>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<Label for="custom-default-model"
					>{UI.SETTINGS_PAGE.PROVIDER_DEFAULT_MODEL}</Label
				>
				<Select.Root type="single" bind:value={defaultModel}>
					<Select.Trigger
						id="custom-default-model"
						data-testid="default-model-select"
						class="w-full"
					>
						{defaultModelTriggerText}
					</Select.Trigger>
					{#if models.length > 0}
						<Select.Content>
							{#each models as model (model)}
								<Select.Item value={model} label={model}>{model}</Select.Item>
							{/each}
						</Select.Content>
					{/if}
				</Select.Root>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="custom-api-key">{UI.SETTINGS_PAGE.API_KEY_LABEL}</Label>
				<Input
					id="custom-api-key"
					type="password"
					data-testid="api-key-input"
					placeholder={UI.SETTINGS_PAGE.API_KEY_PLACEHOLDER}
					autocomplete="off"
					bind:value={apiKey}
				/>
			</div>
		{/if}

		<!-- Footer: save + delete -->
		<div class="mt-auto flex items-center gap-2 pt-2">
			<Button
				data-testid="save-button"
				disabled={!canSave}
				onclick={handleSave}
			>
				{UI.SETTINGS_PAGE.BUTTON_SAVE}
			</Button>
			{#if isCustomEdit && ondelete}
				<Button
					variant="destructive"
					data-testid="delete-button"
					onclick={handleDelete}
				>
					{UI.SETTINGS_PAGE.BUTTON_DELETE}
				</Button>
			{/if}
		</div>
	</div>
{/if}
