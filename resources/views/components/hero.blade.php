@props(['lines' => [], 'background' => null])

<section
    {{ $attributes->class('not-prose relative flex min-h-[32rem] w-full items-end overflow-hidden rounded-2xl bg-[#013983] p-8 text-white lg:p-14') }}
    @if ($background) style="background-image: linear-gradient(90deg, rgb(1 57 131 / .82), rgb(1 57 131 / .25)), url('{{ $background }}'); background-size: cover; background-position: center;" @endif
>
    <div class="relative z-10 flex max-w-4xl flex-col gap-8">
        <h1 class="m-0 text-5xl leading-none tracking-tight lg:text-7xl">
            @foreach ($lines as $line)
                <span class="block">{{ $line }}</span>
            @endforeach
        </h1>
        @if (trim((string) $slot) !== '')
            <div class="flex flex-wrap gap-3">{{ $slot }}</div>
        @endif
    </div>
</section>
