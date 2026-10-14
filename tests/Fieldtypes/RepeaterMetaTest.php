<?php

namespace Estouai\Weave\Tests\Fieldtypes;

use Estouai\Weave\Blocks\BlockRegistry;
use Estouai\Weave\Fieldtypes\Weave;
use Estouai\Weave\Http\Controllers\FieldMetaController;
use Estouai\Weave\Tests\TestCase;
use Illuminate\Http\Request;
use Statamic\Facades\AssetContainer;
use Statamic\Facades\User;
use Statamic\Fields\Field;

class RepeaterMetaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        AssetContainer::make('assets')->disk('local')->save();
        $this->actingAs(tap(User::make()->email('test@example.com')->makeSuper())->save());

        BlockRegistry::registerConfig('repeater_meta_test', [
            'view' => 'unused',
            'props' => [['handle' => 'rows', 'field' => ['type' => 'grid', 'fields' => [
                ['handle' => 'image', 'field' => ['type' => 'assets', 'container' => 'assets', 'max_files' => 1]],
                ['handle' => 'children', 'field' => ['type' => 'grid', 'fields' => [
                    ['handle' => 'label', 'field' => ['type' => 'text']],
                ]]],
            ]]]],
            'defaults' => ['rows' => [['children' => [['label' => 'Default child']]]]],
        ]);
    }

    public function test_preload_metadata_matches_published_row_ids_including_nested_blocks(): void
    {
        $node = ['id' => 'node', 'type' => 'repeater_meta_test', 'props' => [
            'rows' => [['children' => [['label' => 'Saved child']]]],
        ]];
        $field = (new Field('builder', ['type' => 'weave']))->setValue([
            ['id' => 'parent', 'type' => 'column', 'props' => [], 'children' => [$node]],
        ])->preProcess();

        $published = $field->value()[0]['children'][0]['props'];
        $meta = $field->meta()['nodeMeta']['node'];

        $this->assertRowMeta($published, $meta);
    }

    public function test_metadata_refresh_keeps_client_row_ids(): void
    {
        $props = ['rows' => [['_id' => 'client-row', 'image' => [], 'children' => [
            ['_id' => 'client-child', 'label' => 'Edited child'],
        ]]]];
        $response = (new FieldMetaController)->render(Request::create('/', 'POST', [
            'type' => 'repeater_meta_test', 'props' => $props,
        ]));

        $this->assertRowMeta($props, $response->getData(true)['meta']);
    }

    public function test_palette_defaults_and_new_rows_have_matching_metadata(): void
    {
        $preload = json_decode(json_encode((new Weave)->preload(), JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
        $definition = collect($preload['blockTypes'])->firstWhere('type', 'repeater_meta_test');

        $this->assertRowMeta($definition['defaults'], $definition['meta']);
        $this->assertArrayHasKey('dynamicFolder', $definition['meta']['rows']['new']['image']);
        $this->assertSame([], $definition['meta']['rows']['new']['children']['existing']);
    }

    private function assertRowMeta(array $props, array $meta): void
    {
        $row = $props['rows'][0];
        $this->assertArrayHasKey($row['_id'], $meta['rows']['existing']);
        $rowMeta = $meta['rows']['existing'][$row['_id']];
        $this->assertArrayHasKey('dynamicFolder', $rowMeta['image']);
        $this->assertArrayHasKey($row['children'][0]['_id'], $rowMeta['children']['existing']);
    }
}
