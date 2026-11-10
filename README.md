# ComfyUI-LivePreviewMonitor
Live previews in ComfyUI on the main graph (or anywhere). The node grabs the preview from the Ksampler. If you came from Forge NEO or some other software that shows a live preview as it generates, this is what you're likely looking for. Simply add the custom node and it will show the generation in progress.

How it works: ComfyUI streams the sampler’s preview frames to the browser over the websocket, tagged with the id of the node that produced them. The node listens to that stream and draws the frames itself. It doesn’t need to be wired to anything, and it works from the main graph even when the KSampler is inside one or two subgraphs. Drop it anywhere and it follows whichever sampler is running. It resizes like any other node, and the image scales to fit while keeping its aspect ratio.
**
Widgets:**

update_every: redraw every N sampler steps. 1 redraws on every step. Skipped frames are dropped before decoding, so a higher number also lowers browser load. The last step is always shown.
source_node_id: optional filter, for workflows with two samplers (base and refine, say). Enter 12, or 5:12 for a node inside a subgraph. The status line under the image shows the id of the sampler currently feeding it, along with the step count.

Rate: I’d start at 1 and go to 3 to 5 only if the browser lags on high-resolution previews. ComfyUI sends a frame every step anyway, so the setting only controls how often the display redraws. For a typical 20-30 step run, every 2 to 3 steps looks nearly the same as every step.

**Things to know:**

Live previews **must** be enabled in ComfyUI. Search settings for “preview method” and set it to auto, or launch with --preview-method auto. Without that the server sends no frames, and the node will sit at “Waiting for a sampler preview…”.
The default latent2rgb preview is blurry color blobs. taesd is much more readable, but it needs the TAESD decoder files for your model family in models/vae_approx. Not every newer model has one.
The node is marked virtual, so it’s never sent to the backend and doesn’t affect caching or execution.
The JS relies on the frontend’s b_preview_with_metadata event and the addDOMWidget API. A big frontend update could shift those, and if one does, the fix is probably a one-line change.

**Installation:**

Run `git clone https://github.com/codeslop55/ComfyUI-LivePreviewMonitor/` in your custom_nodes folder to download the project. No dependencies required. Simply restart comfyu and add the Live Preview Monitor Node anywhere. 
