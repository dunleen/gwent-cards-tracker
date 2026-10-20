// на Windows не нужен отдельный main — точка входа генерируется tauri
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gwent_cards_lib::run()
}
