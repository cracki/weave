@props(['variant' => 'dark', 'href' => null, 'type' => 'button'])

@php
    $variants = [
        'dark' => 'bg-[#013983] text-white hover:bg-[#013983]/90',
        'light' => 'bg-white text-[#013983] hover:bg-white/90',
        'link-blue' => 'text-[#013983] hover:opacity-70',
        'link-green' => 'text-[#1ed699] hover:opacity-70',
        'link-sky' => 'text-[#5a84d8] hover:opacity-70',
    ];
    $classes = 'not-prose inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition '.($variants[$variant] ?? $variants['dark']);
@endphp

@if ($href)
    <a href="{{ $href }}" {{ $attributes->class($classes) }}>{{ $slot }}</a>
@else
    <button type="{{ $type }}" {{ $attributes->class($classes) }}>{{ $slot }}</button>
@endif
