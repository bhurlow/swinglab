use once_cell::sync::Lazy;
use std::sync::Mutex;
use wasm_bindgen::prelude::*;
use web_sys::console;
use rustfft::{FftPlanner, num_complex::Complex};

mod reverb;
mod filter;
use reverb::{process_reverb, initialize_reverb};
use filter::apply_lowpass_filter;

const FFT_SIZE: usize = 2048; // Power of 2 for efficient FFT

#[wasm_bindgen]
pub fn add(left: u32, right: u32) -> u32 {
    console::log_1(&format!("Adding {} and {}", left, right).into());
    left + right
}

static FFT_PLANNER: Lazy<Mutex<FftPlanner<f32>>> = Lazy::new(|| Mutex::new(FftPlanner::new()));

#[wasm_bindgen]
pub fn process_audio(
    input: &[f32], 
    output: &mut [f32], 
    sample_rate: f32, 
    gain: f32, 
    reverb_enabled: bool,
    cutoff_freq: f32
) {
    // Initialize reverb state if not already done
    initialize_reverb(sample_rate);

    // Create a temporary buffer for intermediate processing
    let mut temp_buffer = vec![0.0; input.len()];

    // Process each sample
    for i in 0..input.len() {
        let reverb_out = if reverb_enabled {
            process_reverb(input[i], sample_rate)
        } else {
            0.0
        };
        
        // Mix dry and wet signals
        let wet_mix = if reverb_enabled { 0.25 } else { 0.0 }; // Adjust this to control reverb amount
        temp_buffer[i] = (input[i] * (1.0 - wet_mix) + reverb_out * wet_mix) * gain;
    }

    // Apply lowpass filter
    apply_lowpass_filter(&temp_buffer, output, sample_rate, cutoff_freq);

    // Process FFT on the output buffer for analysis
    if input.len() >= FFT_SIZE {
        let mut planner = FFT_PLANNER.lock().unwrap();
        let fft = planner.plan_fft_forward(FFT_SIZE);
        
        // Convert the last FFT_SIZE samples to complex numbers
        let mut buffer: Vec<Complex<f32>> = output[output.len() - FFT_SIZE..]
            .iter()
            .map(|&x| Complex { re: x, im: 0.0 })
            .collect();
        
        // Perform FFT
        fft.process(&mut buffer);
        
        // Here you can analyze the frequency content
        // For example, you could log the magnitude of the first few frequency bins
        for i in 0..10 {
            let magnitude = (buffer[i].re * buffer[i].re + buffer[i].im * buffer[i].im).sqrt();
            console::log_1(&format!("Frequency bin {} magnitude: {}", i, magnitude).into());
        }
    }
}
