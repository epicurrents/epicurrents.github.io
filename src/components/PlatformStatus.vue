<script setup lang="ts">
/**
 * Platform availability banner shown at the top of every platform documentation page.
 *
 * To advance the status, change PLATFORM_STATUS to the next value.
 * To remove the banner entirely once the platform is established, set it to null.
 *
 * Stages:
 *   'closed-testing'  — danger   — not publicly available
 *   'public-testing'  — warning  — available but expect breaking changes
 *   'stable'          — success  — production-ready (remove banner after a few months)
 *    null             — (no banner)
 */
const PLATFORM_STATUS: 'closed-testing' | 'public-testing' | 'stable' | null = 'closed-testing'

const STATUS_CONFIG = {
    'closed-testing': {
        variant: 'danger',
        icon: 'flask',
        title: 'Closed testing',
        message: 'The Epicurrents platform is currently in closed testing and is not publicly available. Documentation may be incomplete or subject to change.',
    },
    'public-testing': {
        variant: 'warning',
        icon: 'triangle-exclamation',
        title: 'Public testing',
        message: 'The Epicurrents platform is available for public testing. Expect breaking changes between releases. Please report issues on GitHub.',
    },
    'stable': {
        variant: 'success',
        icon: 'circle-check',
        title: 'Now stable',
        message: 'The Epicurrents platform has reached stable release. See the changelog for what\'s new.',
    },
} as const

const config = PLATFORM_STATUS ? STATUS_CONFIG[PLATFORM_STATUS] : null
</script>

<template>
    <wa-callout v-if="config" :variant="config.variant" class="platform-status">
        <wa-icon slot="icon" :name="config.icon" variant="regular"></wa-icon>
        <strong>{{ config.title }}</strong> — {{ config.message }}
    </wa-callout>
</template>

<style scoped>
.platform-status {
    margin-block-end: 1.5rem;
}
</style>
