
import sys
import os
import winreg
import ctypes

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def register_protocol():
    # Define the protocol name and the path to the executable
    PROTOCOL_NAME = "webchurch"
    
    # We assume this script is running from 'python/' folder.
    # The EXE is expected to be in 'python/dist/WebChurchBot.exe' after build.
    # Or if running raw python, we might point to python.exe + script.
    # But for end-user convenience, let's point to the dist EXE path.
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    exe_path = os.path.join(current_dir, "dist", "WebChurchBot.exe")
    
    if not os.path.exists(exe_path):
        print(f"Warning: The executable was not found at: {exe_path}")
        print("Please run 'build_exe.bat' first, or ensure the path is correct.")
        # We continue anyway to register the path where it SHOULD be.

    print(f"Registering '{PROTOCOL_NAME}://' to run: {exe_path}")

    try:
        # Create HKCR\webchurch
        key_path = f"Software\\Classes\\{PROTOCOL_NAME}"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f"URL:{PROTOCOL_NAME} Protocol")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")

        # Create HKCR\webchurch\shell\open\command
        command_key_path = f"{key_path}\\shell\\open\\command"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, command_key_path) as key:
            # "%1" passes the argument (the URL) to the app
            command_val = f'"{exe_path}" "%1"'
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, command_val)
            
        print("Successfully registered custom protocol!")
        print("You can now trigger the bot from the web app.")

    except Exception as e:
        print(f"Failed to register protocol: {e}")
        # If writing to HKEY_CLASSES_ROOT failed (requires admin), try HKCU (Current User) which we did above.
        # But if we were trying HKLM, we'd need admin. HKCU is usually safe without admin for protocols on Win10/11.

if __name__ == "__main__":
    register_protocol()
    input("Press Enter to exit...")
