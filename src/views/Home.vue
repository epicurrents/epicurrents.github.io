<script setup lang="ts">
const license = `Copyright 2019- Sampsa Lohi

Licensed under the Apache License, Version 2.0 (the "License");
you may not use the files in this repository except in compliance
with the License. You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`
</script>

<template>
    <div class="content">
        <h1>Epicurrents</h1>
        <blockquote>
            Epicurrents is an open-source, modular and extensible library for reading, processing and displaying
            neurophysiological signal data in the web browser.
        </blockquote>
        <wa-callout>
            <wa-icon slot="icon" name="circle-info" variant="regular"></wa-icon>
            This is an initial release of the documentation and is constantly updated to cover
            more features of the library.
        </wa-callout>
        <h2>Core features</h2>
        <ul class="features">
            <li>
                <wa-icon name="file-export" family="duotone" variant="light" fixed-width></wa-icon>
                Read signal data in various formats
            </li>
            <li>
                <wa-icon name="chart-line" family="duotone" variant="light" fixed-width></wa-icon>
                Visualize data with an intuitive, interactive user interface
            </li>
            <li>
                <wa-icon name="user-graduate" family="duotone" variant="light" fixed-width></wa-icon>
                Emulate a professional review process for educational examples
            </li>
            <li>
                <wa-icon name="magnifying-glass" family="duotone" variant="light" fixed-width></wa-icon>
                Inspect and annotate signal datasets
            </li>
            <li>
                <wa-icon name="code" family="duotone" variant="solid" fixed-width></wa-icon>
                Process signal data with native JavaScript and Python
            </li>
            <li>
                <wa-icon name="puzzle-piece" family="duotone" variant="light" fixed-width></wa-icon>
                Extend the library with custom modules
            </li>
        </ul>
        <h2>Using the documentation</h2>
        <p>
            The documentation is organized into sections that describe the library's features and how to use them.
            Each section is accessible from the navigation menu on the left side of the page.
        </p>
        <p>
            <router-link to="docs/introduction">Introduction</router-link>
            details some of the main aspects of the library and quick access to more detailed documentation.
        </p>
        <p>
            <router-link to="docs/getting-started">Getting started</router-link>
            is a good place to start if you need information on how to get access to the application.
            This section contains information on installation and basic requirements of running the application.
        </p>
        <p>
            The <router-link to="docs/user-interface">user interface</router-link> section
            has a more complete breakdown of the default application interface and its features.
        </p>
        <h3>Study modules</h3>
        <p>
            This section contains documentation on the study modules that are included in the library. Included modules
            determine which study modalities can be processend and viewed in the application.
        </p>
        <h3>File readers</h3>
        <p>
            File readers for different general-purpose and vendor-specific open file formats can be found under this
            section.
        </p>
        <h2>License</h2>
        <pre class="license">{{ license }}</pre>
        <p>
            Epicurrents logo &copy; 2025 Sampsa Lohi, all rights reserved.
        </p>
    </div>
</template>

<style scoped>
.features {
    background-color: var(--wa-color-brand-fill-quiet);
    border-radius: 0.5em;
    font-size: 1.2em;
    list-style-type: none;
    margin-block-end: 0;
    margin-inline-start: 0;
    padding: 0.5em 1em;
}
    .features li {
        margin: 0.5em 0.25em;
        padding-left: 1.8em;
        text-indent: -1.8em;
    }
    .content li wa-icon {
        position: relative;
        top: 0.25em;
        vertical-align: top;
        margin-inline-end: 0.5em;
        color: var(--wa-color-brand-on-normal);
    }
    .note {
        display: flex;
    }
        .note .icon {
            flex: 0 0 auto;
            margin-right: 0.5em;
        }
        .note .text {
            flex: 1 1 auto;
        }
    .license {
        display: block;
        font-size: 0.9em;
        margin: 1em 0;
        padding: 1rem;
        background-color: var(--wa-color-fill-quiet);
        border-radius: 0.5rem;
    }
</style>
