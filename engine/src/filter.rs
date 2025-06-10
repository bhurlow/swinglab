use rustfft::{FftPlanner, num_complex::Complex};
use std::sync::Mutex;
use once_cell::sync::Lazy;

const FFT_SIZE: usize = 2048; // Power of 2 for efficient FFT

static FFT_PLANNER: Lazy<Mutex<FftPlanner<f32>>> = Lazy::new(|| Mutex::new(FftPlanner::new()));

pub fn apply_lowpass_filter(input: &[f32], output: &mut [f32], sample_rate: f32, cutoff_freq: f32) {
    if input.len() < FFT_SIZE {
        // If input is too short, just copy it
        output.copy_from_slice(input);
        return;
    }

    let mut planner = FFT_PLANNER.lock().unwrap();
    let fft_forward = planner.plan_fft_forward(FFT_SIZE);
    let fft_inverse = planner.plan_fft_inverse(FFT_SIZE);

    // Convert input to complex numbers
    let mut buffer: Vec<Complex<f32>> = input[..FFT_SIZE]
        .iter()
        .map(|&x| Complex { re: x, im: 0.0 })
        .collect();

    // Apply forward FFT
    fft_forward.process(&mut buffer);

    // Calculate frequency resolution
    let freq_resolution = sample_rate / FFT_SIZE as f32;
    let cutoff_bin = (cutoff_freq / freq_resolution) as usize;

    // Apply lowpass filter in frequency domain with stronger cutoff
    for i in 0..FFT_SIZE {
        if i > cutoff_bin {
            // Apply stronger rolloff to avoid ringing
            let rolloff = if i < cutoff_bin + 5 {
                // Sharper transition over 5 bins
                let t = (i - cutoff_bin) as f32 / 5.0;
                // Use a steeper curve: t^4 for stronger attenuation
                (1.0 - t).powi(4)
            } else {
                0.0
            };
            buffer[i] *= rolloff;
        }
    }

    // Apply inverse FFT
    fft_inverse.process(&mut buffer);

    // Copy back to output, scaling by FFT size
    let scale = 1.0 / FFT_SIZE as f32;
    for i in 0..FFT_SIZE {
        output[i] = buffer[i].re * scale;
    }

    // If input is longer than FFT_SIZE, process remaining samples
    if input.len() > FFT_SIZE {
        output[FFT_SIZE..].copy_from_slice(&input[FFT_SIZE..]);
    }
} 