const replayBtn = document.getElementById("replay");

const folderInput = document.createElement("input");
folderInput.type = "file";
folderInput.webkitdirectory = true;
folderInput.hidden = true;
document.body.appendChild(folderInput);

replayBtn.addEventListener("click", () => {
    const messageBox = document.getElementById("replayMessage");
    messageBox.style.display = "block";

    setTimeout(() => {
        messageBox.style.display = "none";
    }, 4000); 

    folderInput.click();
});

folderInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files);
    handleFiles(files);
});

function handleFiles(files) {
    const validFiles = files.filter((file) => {
        const name = file.name.toLowerCase();
        const path = file.fullPath?.toLowerCase() || file.webkitRelativePath?.toLowerCase() || "";

        return (
            name.endsWith(".db3") ||
            name.endsWith(".yaml") ||
            name === "meta" ||
            path.includes("meta")
        );
    });

    if (validFiles.length === 0) {
        alert("No .db3 or metadata files found in the selected folder/subfolders.");
        return;
    }

    validFiles.forEach(uploadFile);
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then((res) => res.json())
    .then((data) => console.log("Uploaded:", data))
    .catch((err) => console.error("Upload failed:", err));
}

