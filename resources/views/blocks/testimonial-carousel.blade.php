@props(['props' => [], 'editing' => false])

<x-weave::testimonial-carousel :quotes="$props['quotes'] ?? []" :editing="$editing" />
