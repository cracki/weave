@props(['quotes' => [], 'editing' => false])

<div {{ $attributes->class('not-prose flex w-full snap-x gap-5 overflow-x-auto pb-3') }}>
    @forelse ($quotes as $quote)
        <figure @if($editing) data-weave-row="{{ $quote['id'] ?? '' }}" @endif class="min-w-[min(32rem,85%)] snap-start rounded-2xl bg-[#eaf1ff] p-8">
            <blockquote class="text-xl leading-relaxed text-[#303030]">“{{ $quote['quote'] ?? '' }}”</blockquote>
            @if (! empty($quote['author']))
                <figcaption class="mt-5 text-sm font-semibold text-[#013983]">{{ $quote['author'] }}</figcaption>
            @endif
        </figure>
    @empty
        <div class="min-h-40 w-full rounded-2xl bg-[#eaf1ff]"></div>
    @endforelse
</div>
