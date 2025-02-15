<script setup lang="ts">

</script>

<template>
    <div class="content">
        <h1>Epicurrents</h1>
        <blockquote>
            Epicurrents is an open-source, modular and extensible library for reading, processing and displaying
            neurophysiological signal data in the web browser.
        </blockquote>
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
                <wa-icon name="code" family="duotone" variant="light" fixed-width></wa-icon>
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
        <h2>License</h2>
        <code class="license">
            <p>Copyright 2019-2025 Sampsa Lohi & Epicurrents contributors</p>
            <p>
                Licensed under the Apache License, Version 2.0 (the "License");
                you may not use the files in this repository except in compliance
                with the License. You may obtain a copy of the License at
            </p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;http://www.apache.org/licenses/LICENSE-2.0</p>
            <p>
                Unless required by applicable law or agreed to in writing, software
                distributed under the License is distributed on an "AS IS" BASIS,
                WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                See the License for the specific language governing permissions and
                limitations under the License.
            </p>
        </code>
    </div>
</template>

<style scoped>
.features {
    list-style-type: none;
    padding: 0.5em 1em;
    font-size: 1.2em;
    background-color: var(--wa-color-brand-fill-quiet);
    border-radius: 0.5em;
}
    .features li {
        margin: 0.5em 0.25em;
        padding-left: 1.8em;
        text-indent: -1.8em;
    }
    .features wa-icon {
        position: relative;
        top: 0.25em;
        vertical-align: top;
        margin-inline-end: 0.5em;
        color: var(--wa-color-brand-on-normal);
    }
    .license {
        font-size: 0.8em;
    }
</style>
