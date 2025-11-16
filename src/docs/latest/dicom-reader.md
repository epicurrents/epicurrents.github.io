[[toc]]

## Capabilities

The DICOM ([Data Interchange Standard for Biomedical Imaging](https://www.dicomstandard.org/)) is an open, general purpose format for storing medica imaging data, with support for a wide range of modalities from radiology and nuclear medicine to ECG and digital pathology. [WG-32](https://www.dicomstandard.org/activity/wgs/wg-32) has been working on extending the DICOM standard to include neurophysiological test modalities and thanks to their efforts, a number of test types are already supported, with others still under development.

The Epicurrents DICOM reader is intended as a general purpose data reader that can parse different test types. It currently supports single-file routine EEG recordings, including annotations. Due to the RAM requirements of DICOM file parsing and limited support of video file types for direct playback in web browsers, video-EEG is not supported.
