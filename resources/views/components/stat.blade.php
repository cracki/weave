@props(['value' => '', 'label' => ''])

<div {{ $attributes->class('not-prose border-t border-black/10 pt-5') }}>
    <p class="text-4xl leading-none tracking-tight text-[#013983]">{{ $value }}</p>
    <p class="mt-2 text-sm text-[#303030]/70">{{ $label }}</p>
</div>
