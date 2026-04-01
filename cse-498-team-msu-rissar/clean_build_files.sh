#!/bin/bash

VERBOSE=0

pinfo(){
	echo "*** $1 ***"
}

perror(){
	echo "!!! $1 !!!"
}


remove_folder(){
	name=$1

	initial_count=$(find . -type d -name "$name" | wc -l)

	if [ $initial_count -eq 0 ]; then
		pinfo "No $name folder to remove!"
		return
	fi

	# find and delete all folders with $name and do not print err
	find . -type d -name "$name" -exec rm -rf {} + 2>/dev/null

	not_removed_count=$(find . -type d -name "$name" | wc -l)
	removed_count=$((initial_count-not_removed_count))

	if [ $removed_count -gt 0 ]; then
		pinfo "Successfully removed $removed_count $name folders."
	else
		perror "Failed to remove any $name folders!"
		pinfo "Attempting to remove using sudo!"

		sudo find . -type d -name "$name" exec -rm rf {} + 2>/dev/null
		not_removed_count=$(find . -type d -name "$name" | wc -l)
		if [ $removed_count -gt 0 ]; then
			pinfo "Successfully remove $removed_count $name folders using sudo."
		else
			perror "Failed to remove $name folders using sudo."
		fi
	fi
}


remove_folder "build"
remove_folder "install"
remove_folder "log"
remove_folder "logs"


echo "All done! :)"
