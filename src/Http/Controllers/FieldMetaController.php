<?php

namespace Estouai\Weave\Http\Controllers;

use Estouai\Weave\Blocks\BlockRegistry;
use Estouai\Weave\Fieldtypes\Weave;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class FieldMetaController extends Controller
{
    // Newly added nodes and relationship changes need metadata for their
    // current publish-format props, with the same row IDs as the client.
    public function render(Request $request)
    {
        $data = $request->validate(['type' => 'required|string', 'props' => 'array']);

        $block = BlockRegistry::find($data['type']);
        abort_unless($block, 404);

        $meta = Weave::metaForNode($data['type'], $data['props'] ?? []);

        return response()->json(['meta' => $meta]);
    }
}
