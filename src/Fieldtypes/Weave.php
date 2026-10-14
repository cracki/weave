<?php

namespace Estouai\Weave\Fieldtypes;

use Estouai\Weave\Blocks\BlockRegistry;
use Estouai\Weave\Support\BlockTreeAugmentor;
use Illuminate\Support\Facades\Log;
use Statamic\Fields\Blueprint;
use Statamic\Fields\Fieldtype;
use Statamic\Fields\Value;

class Weave extends Fieldtype
{
    protected $categories = ['structured'];

    public function defaultValue()
    {
        return [];
    }

    public function preProcess($data)
    {
        return collect($data ?? [])
            ->map(fn ($node) => static::preProcessNode($node))
            ->values()
            ->all();
    }

    protected static function preProcessNode(array $node): array
    {
        $block = BlockRegistry::find($node['type'] ?? '');

        if (! $block) {
            return $node;
        }

        $node['props'] = Blueprint::make()
            ->setContents(['fields' => $block->finalPropsSchema()])
            ->fields()
            ->addValues($node['props'] ?? [])
            ->preProcess()
            ->values()
            ->all();

        if (! empty($node['children'])) {
            $node['children'] = collect($node['children'])->map(fn ($child) => static::preProcessNode($child))->all();
        }

        return $node;
    }

    public function process($data)
    {
        return collect($data ?? [])
            ->filter(function ($node) {
                if (! BlockRegistry::find($node['type'] ?? '')) {
                    Log::warning("weave: unknown block type [{$node['type']}] dropped on save");

                    return false;
                }

                return true;
            })
            ->map(fn ($node) => static::processNode($node))
            ->values()
            ->all();
    }

    protected static function processNode(array $node): array
    {
        $block = BlockRegistry::find($node['type']);

        $node['props'] = Blueprint::make()
            ->setContents(['fields' => $block->finalPropsSchema()])
            ->fields()
            ->addValues($node['props'] ?? [])
            ->process()
            ->values()
            ->all();

        if (! empty($node['children'])) {
            $node['children'] = collect($node['children'])->map(fn ($child) => static::processNode($child))->all();
        }

        return $node;
    }

    public function augment($value)
    {
        return BlockTreeAugmentor::augment($value);
    }

    public function preload()
    {
        return [
            'blockTypes' => BlockRegistry::all()->map(function ($block) {
                $fields = Blueprint::make()
                    ->setContents(['fields' => $block->finalPropsSchema()])
                    ->fields()
                    ->addValues($block->finalDefaultProps());

                // Grid metadata is keyed by publish-format _id values. Generate
                // those before metadata, and use the same IDs in palette defaults.
                $defaults = $fields->preProcess()->values()->all();
                $metaFields = Blueprint::make()
                    ->setContents(['fields' => $block->finalPropsSchema()])
                    ->fields()
                    ->addValues($defaults);

                return [
                    'type' => $block->type(),
                    'label' => $block->label(),
                    'icon' => $block->iconName(),
                    'iconSvg' => $block->iconSvg(),
                    'category' => $block->category(),
                    'allowsChildren' => $block->allowsChildren(),
                    'fields' => $fields->toPublishArray(),
                    'meta' => $metaFields->meta(),
                    'defaults' => $defaults,
                ];
            })->values()->all(),

            // Per-node field meta (Grid row metas, resolved relational titles/
            // thumbnails, ...), keyed by node id, computed from each node's
            // actual publish values. The CP's scoped node container reads this so
            // container-managed fieldtypes bind real data instead of the empty
            // type-level defaults. fetchNodeMeta() covers nodes added later.
            'nodeMeta' => $this->preloadNodeMeta(),
        ];
    }

    protected function preloadNodeMeta(): array
    {
        $nodes = $this->field?->value();

        if ($nodes instanceof Value) {
            $nodes = $nodes->value();
        }

        return $this->collectNodeMeta(is_array($nodes) ? $nodes : []);
    }

    protected function collectNodeMeta(array $nodes): array
    {
        $meta = [];

        foreach ($nodes as $node) {
            if (! is_array($node) || ! isset($node['id'], $node['type'])) {
                continue;
            }

            $meta[$node['id']] = static::metaForNode($node['type'], $node['props'] ?? []);

            if (! empty($node['children'])) {
                $meta += $this->collectNodeMeta($node['children']);
            }
        }

        return $meta;
    }

    // Both preload() and the CP refresh endpoint receive publish-format props.
    // Use those values directly: Grid::preProcess() consumes the stored `id`
    // and generates a fresh `_id` when run again on a published row. Doing it
    // here disconnects `existing` metadata from the rows being edited,
    // including assets and nested grids inside them.
    public static function metaForNode(string $type, array $props): array
    {
        $block = BlockRegistry::find($type);

        if (! $block) {
            return [];
        }

        return Blueprint::make()
            ->setContents(['fields' => $block->finalPropsSchema()])
            ->fields()
            ->addValues($props)
            ->meta()
            ->all();
    }
}
