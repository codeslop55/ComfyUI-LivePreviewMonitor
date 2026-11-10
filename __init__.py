"""
Live Preview Monitor
--------------------
Shows the sampler's live latent preview in a resizable node on whatever graph
the node is placed on, so you don't have to open subgraphs to watch sampling.

All the real work happens in the frontend (web/live_preview_monitor.js).
This Python class only exists so the node shows up in the node library/search.
It has no inputs/outputs and is never executed.
"""


class LivePreviewMonitor:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "update_every": (
                    "INT",
                    {
                        "default": 1,
                        "min": 1,
                        "max": 500,
                        "step": 1,
                        "tooltip": "Redraw the preview every N sampler steps "
                                   "(1 = every step). The final step is always shown.",
                    },
                ),
                "source_node_id": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                        "tooltip": "Optional. Only show previews from this sampler node id "
                                   "(e.g. 12, or 5:12 for a node inside a subgraph). "
                                   "Leave empty to follow whichever sampler is running.",
                    },
                ),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "image/preview"
    OUTPUT_NODE = False

    def noop(self, **kwargs):
        return ()


NODE_CLASS_MAPPINGS = {"LivePreviewMonitor": LivePreviewMonitor}
NODE_DISPLAY_NAME_MAPPINGS = {"LivePreviewMonitor": "Live Preview Monitor"}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
