[[toc]]

## Capabilities

The DICOM ([Data Interchange Standard for Biomedical Imaging](https://www.dicomstandard.org/)) is an open, general purpose format for storing medical imaging data, with support for a wide range of modalities from radiology and nuclear medicine to ECG and digital pathology. [WG-32](https://www.dicomstandard.org/activity/wgs/wg-32) has been working on extending the DICOM standard to include neurophysiological test modalities and thanks to their efforts, a number of test types are already supported, with others still under development.

The Epicurrents DICOM reader is intended as a general purpose data reader that can parse different test types. It currently supports single-file routine EEG recordings, including annotations. Due to the RAM requirements of DICOM file parsing and limited support of video file types for direct playback in web browsers, video-EEG is not supported.

## Supported waveform data

A DICOM waveform instance stores its samples in a multiplex group: a set of channels that share a sampling frequency, with their samples interleaved. The reader reads one multiplex group per instance, which is what the neurophysiology test types use.

Samples may be 8, 16 or 32 bits wide, signed or unsigned, and the reader follows the encoding the instance declares. The two companded 8-bit encodings (mu-law and A-law, which the standard provides for audio waveforms) and the 64-bit encodings are not read; a recording using one of them is reported as unsupported rather than displayed incorrectly.

Channel calibration is applied as the standard defines it, from the channel's sensitivity, its correction factor and its baseline, and the samples are then converted to SI units — volts for an EEG recording — so amplitudes are comparable with recordings read from any other format. Each channel still reports the unit its file was written in.

Where a recording declares that an individual channel's samples are skewed in time relative to the rest of its group, the skew is not corrected for and the channel is displayed as though it were aligned. This is reported in the log when it occurs.

## Annotations

Annotations are optional in the format, and a recording without any is read normally.

An annotation may mark an instant, a span, or several of either, and each form is converted to the corresponding events. An annotation carrying no position of its own applies to the whole recording. Annotations are positioned by their offset into the recording or by the sample they fall on; one positioned only by an absolute date and time is skipped, because relating it to the start of the data requires the acquisition clock to have been synchronised, which a recording is not obliged to state.

An annotation that names particular channels is attached to those channels by label. One that names a whole multiplex group becomes a general annotation.
