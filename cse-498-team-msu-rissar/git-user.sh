#!/bin/bash

# Git User Config Manager
# Manages git username and email configurations with saved profiles

CONFIG_FILE="$HOME/.git-users.conf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --set              Set git user config interactively"
    echo "  -a, --add              Add and save a new user profile"
    echo "  -l, --list             List all saved user profiles"
    echo "  -u, --use <profile>    Switch to a saved user profile"
    echo "  -d, --delete <profile> Delete a saved user profile"
    echo "  -c, --current          Show current git user config"
    echo "  -g, --global           Apply changes globally (default is local repo)"
    echo "  -h, --help             Display this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --set               # Set user config interactively"
    echo "  $0 --add               # Add a new saved profile"
    echo "  $0 --use work          # Switch to 'work' profile"
    echo "  $0 --list              # List all saved profiles"
    exit 0
}

# Function to check if in a git repository (for local config)
check_git_repo() {
    if [ "$SCOPE" != "--global" ] && ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}Error: Not in a git repository. Use --global flag for global config.${NC}"
        exit 1
    fi
}

# Function to get current git user config
show_current() {
    echo -e "${BLUE}Current Git Configuration:${NC}"
    local username=$(git config $SCOPE user.name 2>/dev/null)
    local email=$(git config $SCOPE user.email 2>/dev/null)

    if [ -z "$username" ] && [ -z "$email" ]; then
        echo -e "${YELLOW}No git user configuration found.${NC}"
    else
        echo -e "Name:  ${GREEN}${username:-Not set}${NC}"
        echo -e "Email: ${GREEN}${email:-Not set}${NC}"
        echo -e "Scope: ${GREEN}${SCOPE/--/}${NC}"
    fi
}

# Function to set git user config
set_config() {
    echo -e "${BLUE}Set Git User Configuration${NC}"

    read -p "Enter your name: " name
    read -p "Enter your email: " email

    if [ -z "$name" ] || [ -z "$email" ]; then
        echo -e "${RED}Error: Name and email cannot be empty.${NC}"
        exit 1
    fi

    git config $SCOPE user.name "$name"
    git config $SCOPE user.email "$email"

    echo -e "${GREEN}✓ Git user config updated successfully!${NC}"
    show_current

    read -p "Do you want to save this as a profile? (y/n): " save_choice
    if [ "$save_choice" = "y" ] || [ "$save_choice" = "Y" ]; then
        read -p "Enter profile name: " profile_name
        save_profile "$profile_name" "$name" "$email"
    fi
}

# Function to save a user profile
save_profile() {
    local profile_name="$1"
    local name="$2"
    local email="$3"

    if [ -z "$profile_name" ]; then
        echo -e "${RED}Error: Profile name cannot be empty.${NC}"
        exit 1
    fi

    # Create config file if it doesn't exist
    touch "$CONFIG_FILE"

    # Check if profile already exists
    if grep -q "^\[$profile_name\]" "$CONFIG_FILE"; then
        read -p "Profile '$profile_name' already exists. Overwrite? (y/n): " overwrite
        if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
            echo -e "${YELLOW}Profile not saved.${NC}"
            return
        fi
        # Remove old profile
        sed -i "/^\[$profile_name\]/,/^$/d" "$CONFIG_FILE"
    fi

    # Save new profile
    echo "[$profile_name]" >> "$CONFIG_FILE"
    echo "name=$name" >> "$CONFIG_FILE"
    echo "email=$email" >> "$CONFIG_FILE"
    echo "" >> "$CONFIG_FILE"

    echo -e "${GREEN}✓ Profile '$profile_name' saved successfully!${NC}"
}

# Function to add a new profile
add_profile() {
    echo -e "${BLUE}Add New User Profile${NC}"

    read -p "Enter profile name: " profile_name
    read -p "Enter name: " name
    read -p "Enter email: " email

    if [ -z "$profile_name" ] || [ -z "$name" ] || [ -z "$email" ]; then
        echo -e "${RED}Error: All fields are required.${NC}"
        exit 1
    fi

    save_profile "$profile_name" "$name" "$email"
}

# Function to list all saved profiles
list_profiles() {
    if [ ! -f "$CONFIG_FILE" ] || [ ! -s "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}No saved profiles found.${NC}"
        exit 0
    fi

    echo -e "${BLUE}Saved User Profiles:${NC}"
    echo ""

    local profile=""
    local name=""
    local email=""

    while IFS= read -r line; do
        if [[ $line =~ ^\[(.+)\]$ ]]; then
            if [ -n "$profile" ]; then
                echo -e "  ${GREEN}$profile${NC}"
                echo -e "    Name:  $name"
                echo -e "    Email: $email"
                echo ""
            fi
            profile="${BASH_REMATCH[1]}"
            name=""
            email=""
        elif [[ $line =~ ^name=(.+)$ ]]; then
            name="${BASH_REMATCH[1]}"
        elif [[ $line =~ ^email=(.+)$ ]]; then
            email="${BASH_REMATCH[1]}"
        fi
    done < "$CONFIG_FILE"

    # Print last profile
    if [ -n "$profile" ]; then
        echo -e "  ${GREEN}$profile${NC}"
        echo -e "    Name:  $name"
        echo -e "    Email: $email"
    fi
}

# Function to use a saved profile
use_profile() {
    local profile_name="$1"

    if [ -z "$profile_name" ]; then
        echo -e "${RED}Error: Profile name required.${NC}"
        exit 1
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}Error: No saved profiles found.${NC}"
        exit 1
    fi

    local found=false
    local name=""
    local email=""
    local current_profile=""

    while IFS= read -r line; do
        if [[ $line =~ ^\[(.+)\]$ ]]; then
            current_profile="${BASH_REMATCH[1]}"
            if [ "$current_profile" = "$profile_name" ]; then
                found=true
            fi
        elif [ "$found" = true ]; then
            if [[ $line =~ ^name=(.+)$ ]]; then
                name="${BASH_REMATCH[1]}"
            elif [[ $line =~ ^email=(.+)$ ]]; then
                email="${BASH_REMATCH[1]}"
                break
            fi
        fi
    done < "$CONFIG_FILE"

    if [ "$found" = false ] || [ -z "$name" ] || [ -z "$email" ]; then
        echo -e "${RED}Error: Profile '$profile_name' not found.${NC}"
        exit 1
    fi

    git config $SCOPE user.name "$name"
    git config $SCOPE user.email "$email"

    echo -e "${GREEN}✓ Switched to profile '$profile_name'${NC}"
    show_current
}

# Function to delete a profile
delete_profile() {
    local profile_name="$1"

    if [ -z "$profile_name" ]; then
        echo -e "${RED}Error: Profile name required.${NC}"
        exit 1
    fi

    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${RED}Error: No saved profiles found.${NC}"
        exit 1
    fi

    if ! grep -q "^\[$profile_name\]" "$CONFIG_FILE"; then
        echo -e "${RED}Error: Profile '$profile_name' not found.${NC}"
        exit 1
    fi

    sed -i "/^\[$profile_name\]/,/^$/d" "$CONFIG_FILE"
    echo -e "${GREEN}✓ Profile '$profile_name' deleted successfully!${NC}"
}

# Main script logic
SCOPE="--local"
ACTION=""
PROFILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--set)
            ACTION="set"
            shift
            ;;
        -a|--add)
            ACTION="add"
            shift
            ;;
        -l|--list)
            ACTION="list"
            shift
            ;;
        -u|--use)
            ACTION="use"
            PROFILE="$2"
            shift 2
            ;;
        -d|--delete)
            ACTION="delete"
            PROFILE="$2"
            shift 2
            ;;
        -c|--current)
            ACTION="current"
            shift
            ;;
        -g|--global)
            SCOPE="--global"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Execute action
case $ACTION in
    set)
        check_git_repo
        set_config
        ;;
    add)
        add_profile
        ;;
    list)
        list_profiles
        ;;
    use)
        check_git_repo
        use_profile "$PROFILE"
        ;;
    delete)
        delete_profile "$PROFILE"
        ;;
    current)
        show_current
        ;;
    *)
        usage
        ;;
esac
