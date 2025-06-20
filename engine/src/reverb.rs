use once_cell::sync::Lazy;
use std::sync::Mutex;

// Constants for reverb
pub const MAX_DELAY_LENGTH: usize = 44100; // 1 second at 44.1kHz
pub const NUM_DELAYS: usize = 8; // Increased from 4 to 8 delay lines

pub struct ReverbState {
    delay_buffers: Vec<Vec<f32>>,
    delay_times: [usize; NUM_DELAYS],
    delay_positions: [usize; NUM_DELAYS],
    feedback: f32,
    damping: f32,
    damping_high: f32,
    damping_low: f32,
    // Simple low-pass filter state for each delay line
    filter_states: [f32; NUM_DELAYS],
}

impl ReverbState {
    pub fn new(sample_rate: f32) -> Self {
        // Scale delay times based on sample rate
        let base_delay = (MAX_DELAY_LENGTH as f32 * (44100.0 / sample_rate)) as usize;
        
        // Using prime number ratios for delay times to avoid comb filtering
        // These ratios create a more natural reverb response
        ReverbState {
            delay_buffers: vec![vec![0.0; MAX_DELAY_LENGTH]; NUM_DELAYS],
            delay_times: [
                (base_delay as f32 * 0.0297) as usize, // Early reflection
                (base_delay as f32 * 0.0371) as usize, // Early reflection
                (base_delay as f32 * 0.0411) as usize, // Early reflection
                (base_delay as f32 * 0.0437) as usize, // Early reflection
                (base_delay as f32 * 0.0531) as usize, // Main reverb
                (base_delay as f32 * 0.0673) as usize, // Main reverb
                (base_delay as f32 * 0.0797) as usize, // Main reverb
                (base_delay as f32 * 0.0971) as usize, // Main reverb
            ],
            delay_positions: [0; NUM_DELAYS],
            feedback: 0.7, // Increased feedback for longer decay
            damping: 0.5,  // Base damping
            damping_high: 0.3, // More damping for high frequencies
            damping_low: 0.8,  // Less damping for low frequencies
            filter_states: [0.0; NUM_DELAYS],
        }
    }
}

static REVERB_STATE: Lazy<Mutex<Option<ReverbState>>> = Lazy::new(|| Mutex::new(None));

pub fn process_reverb(input: f32, sample_rate: f32) -> f32 {
    let mut reverb_out = 0.0;
    
    let mut state = REVERB_STATE.lock().unwrap();
    if let Some(state) = state.as_mut() {
        // Process each delay line
        for delay_idx in 0..NUM_DELAYS {
            let delay_time = state.delay_times[delay_idx];
            let pos = state.delay_positions[delay_idx];
            
            // Read from delay buffer
            let delayed_sample = state.delay_buffers[delay_idx][pos];
            
            // Apply frequency-dependent damping using a simple low-pass filter
            let filter_coeff = if delay_idx < 4 {
                state.damping_high // More damping for early reflections
            } else {
                state.damping_low  // Less damping for main reverb
            };
            
            // Simple one-pole low-pass filter
            state.filter_states[delay_idx] = state.filter_states[delay_idx] * filter_coeff + 
                delayed_sample * (1.0 - filter_coeff);
            
            // Add to reverb output with different weights for early and late reflections
            let weight = if delay_idx < 4 {
                0.3 // Less weight for early reflections
            } else {
                0.7 // More weight for main reverb
            };
            reverb_out += state.filter_states[delay_idx] * weight;
            
            // Write to delay buffer with feedback
            state.delay_buffers[delay_idx][pos] = input + 
                state.filter_states[delay_idx] * state.feedback;
            
            // Update position
            state.delay_positions[delay_idx] = (pos + 1) % delay_time;
        }
    }
    
    reverb_out
}

pub fn initialize_reverb(sample_rate: f32) {
    let mut state = REVERB_STATE.lock().unwrap();
    if state.is_none() {
        *state = Some(ReverbState::new(sample_rate));
    }
} 