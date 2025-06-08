use wasm_bindgen::prelude::*;
use web_sys::console;

#[wasm_bindgen]
pub fn add(left: u32, right: u32) -> u32 {
    console::log_1(&format!("Adding {} and {}", left, right).into());
    left + right
}

#[wasm_bindgen]
pub fn process_audio(input: &[f32], output: &mut [f32], sample_rate: f32, gain: f32) {
    console::log_1(&format!("Processing audio at {} Hz with gain {}", sample_rate, gain).into());
    for i in 0..input.len() {
        output[i] = input[i] * gain;
    }
    console::log_1(&format!("First few output samples: {:?}", &output[..output.len().min(4)]).into());
}
