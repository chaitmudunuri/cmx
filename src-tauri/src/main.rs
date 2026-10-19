// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

            // Custom Application Menu
            let app_menu = Submenu::with_items(
                app,
                "cmx editor",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[
                    &MenuItem::with_id(app, "new-file", "New File", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "open-file", "Open File...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(app, "open-folder", "Open Folder...", true, Some("CmdOrCtrl+Alt+O"))?,
                    &MenuItem::with_id(app, "save-file", "Save", true, Some("CmdOrCtrl+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "close-tab", "Close Editor", true, Some("CmdOrCtrl+W"))?,
                    &MenuItem::with_id(app, "close-window", "Close Window", true, Some("CmdOrCtrl+Shift+W"))?,
                ],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app, None)?,
                    &PredefinedMenuItem::redo(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, None)?,
                    &PredefinedMenuItem::copy(app, None)?,
                    &PredefinedMenuItem::paste(app, None)?,
                    &PredefinedMenuItem::select_all(app, None)?,
                ],
            )?;

            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::fullscreen(app, None)?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
            app.set_menu(menu)?;

            let icon_bytes = include_bytes!("../icons/icon.png");
            if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_icon(icon);
                }
            }

            #[cfg(target_os = "macos")]
            #[allow(deprecated)]
            unsafe {
                use cocoa::appkit::{NSApp, NSApplication, NSImage};
                use cocoa::base::nil;
                use cocoa::foundation::NSData;

                let data = NSData::dataWithBytes_length_(
                    nil,
                    icon_bytes.as_ptr() as *const std::ffi::c_void,
                    icon_bytes.len() as u64,
                );
                let image = NSImage::initWithData_(NSImage::alloc(nil), data);
                if image != nil {
                    let ns_app = NSApp();
                    ns_app.setApplicationIconImage_(image);
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::Emitter;
            if event.id() == "close-tab" {
                let _ = app.emit("close-active-tab", ());
            } else if event.id() == "new-file" {
                let _ = app.emit("menu-new-file", ());
            } else if event.id() == "open-file" {
                let _ = app.emit("menu-open-file", ());
            } else if event.id() == "open-folder" {
                let _ = app.emit("menu-open-folder", ());
            } else if event.id() == "save-file" {
                let _ = app.emit("menu-save-file", ());
            } else if event.id() == "close-window" {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::read_image_data,
            commands::write_file,
            commands::create_file,
            commands::create_dir,
            commands::rename_path,
            commands::delete_path,
            commands::reveal_in_file_manager,
            commands::list_dir,
            commands::find_files,
            commands::live_grep,
            commands::get_preview,
            commands::get_git_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running cmx editor");
}
