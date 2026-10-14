@props(['props' => [], 'editing' => false])

<x-weave::hero :lines="$props['lines'] ?? []" :background="($props['background'] ?? null)?->url()">
    @foreach ($props['buttons'] ?? [] as $btn)
        <x-weave::button :data-weave-row="$editing ? ($btn['id'] ?? null) : null" :variant="$btn['variant'] ?? 'light'" :href="$btn['href'] ?? '#'">{{ $btn['label'] ?? '' }}</x-weave::button>
    @endforeach
</x-weave::hero>
