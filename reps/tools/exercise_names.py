"""Gives every library exercise a consistent display name: "Movement - Variation (Equipment)".

Examples: "Barbell Bench Press - Medium Grip" -> "Bench Press (Barbell)"
          "Wide-Grip Lat Pulldown"            -> "Lat Pulldown - Wide Grip (Cable)"
          "Pullups"                           -> "Pull Up"

Rules do most of the work; OVERRIDES fixes the ones rules get wrong. Ids never change, only names.
"""
import re

SUFFIX_BY_FIELD = {
    "barbell": "Barbell", "dumbbell": "Dumbbell", "cable": "Cable", "machine": "Machine", "kettlebells": "Kettlebell",
    "bands": "Band", "e-z curl bar": "EZ Bar", "medicine ball": "Medicine Ball", "exercise ball": "Exercise Ball",
}
# Equipment words that may appear inside a name. First match wins.
TOKENS = [
    (r"\bSmith Machine\b|\bSmith\b", "Smith Machine"),
    (r"\bE-?Z[- ]?(?:Curl )?Bar\b", "EZ Bar"),
    (r"\b(?:Two-)?Dumbbells?\b|\bDB\b", "Dumbbell"),
    (r"\bBarbell\b", "Barbell"),
    (r"\bKettlebells?\b", "Kettlebell"),
    (r"\bCable\b", "Cable"),
    (r"\bLeverage\b|\bMachine\b", "Machine"),
    (r"\bMedicine Ball\b", "Medicine Ball"),
    (r"\bExercise Ball\b", "Exercise Ball"),
]
NO_SUFFIX_CATEGORIES = {"stretching", "cardio", "plyometrics"}
WORDS = [
    (r"\bOne[- ]Arm(?:ed)?\b|\bSingle-Arm\b", "Single Arm"), (r"\bOne[- ]Leg(?:ged)?\b|\bSingle-Leg\b", "Single Leg"),
    (r"\bTwo[- ]Arm\b", "Two Arm"), (r"\bTricep\b", "Triceps"), (r"\bFlye?s?\b", "Fly"), (r"\bPull[- ]?[Uu]ps?\b", "Pull Up"),
    (r"\bChin[- ]?[Uu]ps?\b", "Chin Up"), (r"\bPush[- ]?[Uu]ps?\b", "Push Up"), (r"\bSit[- ]?[Uu]ps?\b", "Sit Up"), (r"\bStep[- ]?[Uu]ps?\b", "Step Up"),
    (r"\bSkullcrusher\b", "Skull Crusher"), (r"\bStiff[- ]Leg(?:ged|s)?\b", "Stiff Leg"), (r"\bBent[- ]Over\b", "Bent Over"),
    (r"\bRear[- ]Delt\b", "Rear Delt"), (r"\b(Close|Wide|Reverse|Narrow|Medium)-Grip\b", r"\1 Grip"), (r"\bPalms?-(Up|Down|In)\b", r"Palms \1"),
    (r"\bLow[- ]Pulley\b", "Low Pulley"), (r"\bHigh[- ]Pulley\b", "High Pulley"), (r"\bSide Laterals\b", "Lateral Raise"), (r"\bSide Lateral\b(?! Raise)", "Lateral Raise"),
]
SINGULAR = {
    "Curls": "Curl", "Raises": "Raise", "Presses": "Press", "Rows": "Row", "Squats": "Squat", "Lunges": "Lunge", "Extensions": "Extension",
    "Shrugs": "Shrug", "Pulls": "Pull", "Deadlifts": "Deadlift", "Kickbacks": "Kickback", "Crunches": "Crunch", "Twists": "Twist",
    "Swings": "Swing", "Dips": "Dip", "Pulldowns": "Pulldown", "Mornings": "Morning", "Adductions": "Adduction", "Squeezes": "Squeeze",
}
SMALL = {"with", "and", "to", "a", "an", "the", "on", "of", "from", "off", "in", "for", "at"}
DANGLING = re.compile(r"\b(?:on a|on|with a|with|to a|to|of a|of|off of a|from|and|a)$", re.I)

# Final say, keyed by the dataset's original name.
OVERRIDES = {
    # barbell
    "Barbell Squat": "Squat (Barbell)", "Barbell Full Squat": "Full Squat (Barbell)", "Front Squat (Clean Grip)": "Front Squat - Clean Grip (Barbell)",
    "Standing Military Press": "Overhead Press (Barbell)", "Seated Barbell Military Press": "Seated Overhead Press (Barbell)",
    "Standing Barbell Press Behind Neck": "Behind the Neck Press (Barbell)", "Barbell Shoulder Press": "Shoulder Press (Barbell)",
    "Bench Press - Powerlifting": "Bench Press - Powerlifting (Barbell)", "Barbell Guillotine Bench Press": "Guillotine Bench Press (Barbell)",
    "Bent Over Two-Arm Long Bar Row": "T-Bar Row (Barbell)", "Bent Over One-Arm Long Bar Row": "Single Arm T-Bar Row (Barbell)",
    "One-Arm Long Bar Row": "Single Arm Landmine Row (Barbell)", "T-Bar Row with Handle": "T-Bar Row with Handle (Barbell)",
    "Reverse Grip Bent-Over Rows": "Bent Over Row - Reverse Grip (Barbell)", "Lying Cambered Barbell Row": "Bench Row - Cambered Bar (Barbell)",
    "Barbell Curls Lying Against An Incline": "Incline Curl (Barbell)", "Lying High Bench Barbell Curl": "Lying High Bench Curl (Barbell)",
    "Bradford/Rocky Presses": "Bradford Press (Barbell)", "Standing Bradford Press": "Standing Bradford Press (Barbell)",
    "Barbell Ab Rollout - On Knees": "Ab Rollout - Kneeling (Barbell)", "Barbell Rollout from Bench": "Ab Rollout from Bench (Barbell)",
    "Lying Close-Grip Barbell Triceps Extension Behind The Head": "Lying Triceps Extension - Behind the Head (Barbell)",
    "Standing Palms-Up Barbell Behind The Back Wrist Curl": "Behind the Back Wrist Curl (Barbell)",
    "Palms-Up Barbell Wrist Curl Over A Bench": "Wrist Curl over Bench (Barbell)", "Palms-Down Wrist Curl Over A Bench": "Reverse Wrist Curl over Bench (Barbell)",
    "Seated Palm-Up Barbell Wrist Curl": "Seated Wrist Curl (Barbell)", "Seated Palms-Down Barbell Wrist Curl": "Seated Reverse Wrist Curl (Barbell)",
    "Standing Front Barbell Raise Over Head": "Front Raise - Overhead (Barbell)", "Straight Bar Bench Mid Rows": "Bench Mid Row (Barbell)",
    "Decline Close-Grip Bench To Skull Crusher": "Decline Close Grip Bench to Skull Crusher (Barbell)", "Landmine 180's": "Landmine 180 (Barbell)",
    "Hang Snatch - Below Knees": "Hang Snatch - Below the Knees (Barbell)", "Car Drivers": "Car Driver (Plate)", "Zercher Squats": "Zercher Squat (Barbell)",
    "Jefferson Squats": "Jefferson Squat (Barbell)", "Narrow Stance Squats": "Squat - Narrow Stance (Barbell)", "Wide Stance Barbell Squat": "Squat - Wide Stance (Barbell)",
    "Wide Stance Stiff Legs": "Stiff Leg Deadlift - Wide Stance (Barbell)", "Stiff-Legged Barbell Deadlift": "Stiff Leg Deadlift (Barbell)",
    "Stiff Leg Barbell Good Morning": "Stiff Leg Good Morning (Barbell)", "Speed Squats": "Speed Squat (Barbell)", "Pin Presses": "Pin Press (Barbell)",
    "Rack Pulls": "Rack Pull (Barbell)", "Finger Curls": "Finger Curl (Barbell)", "Smith Incline Shoulder Raise": "Incline Shoulder Raise (Smith Machine)",
    "Wrist Rotations with Straight Bar": "Wrist Rotation (Barbell)", "Preacher Curl": "Preacher Curl (Barbell)", "Drag Curl": "Drag Curl (Barbell)",
    # dumbbell
    "Side Lateral Raise": "Lateral Raise (Dumbbell)", "Seated Side Lateral Raise": "Seated Lateral Raise (Dumbbell)", "One-Arm Side Laterals": "Single Arm Lateral Raise (Dumbbell)",
    "Side Laterals to Front Raise": "Lateral Raise to Front Raise (Dumbbell)", "Lying One-Arm Lateral Raise": "Lying Single Arm Lateral Raise (Dumbbell)",
    "Dumbbell Bicep Curl": "Bicep Curl (Dumbbell)", "Dumbbell Alternate Bicep Curl": "Alternating Bicep Curl (Dumbbell)", "Alternate Hammer Curl": "Alternating Hammer Curl (Dumbbell)",
    "Alternate Incline Dumbbell Curl": "Alternating Incline Curl (Dumbbell)", "Dumbbell Flyes": "Chest Fly (Dumbbell)", "Incline Dumbbell Flyes": "Incline Chest Fly (Dumbbell)",
    "Decline Dumbbell Flyes": "Decline Chest Fly (Dumbbell)", "Incline Dumbbell Flyes - With A Twist": "Incline Chest Fly - with a Twist (Dumbbell)",
    "One-Arm Flat Bench Dumbbell Flye": "Single Arm Chest Fly (Dumbbell)", "Reverse Flyes": "Reverse Fly (Dumbbell)", "Reverse Flyes With External Rotation": "Reverse Fly with External Rotation (Dumbbell)",
    "Tricep Dumbbell Kickback": "Triceps Kickback (Dumbbell)", "Dumbbell Tricep Extension -Pronated Grip": "Triceps Extension - Pronated Grip (Dumbbell)",
    "Standing Dumbbell Press": "Standing Shoulder Press (Dumbbell)", "Seated Dumbbell Press": "Seated Shoulder Press (Dumbbell)", "Dumbbell Shoulder Press": "Shoulder Press (Dumbbell)",
    "Standing Alternating Dumbbell Press": "Alternating Shoulder Press (Dumbbell)", "Standing Palms-In Dumbbell Press": "Shoulder Press - Neutral Grip (Dumbbell)",
    "Standing Palm-In One-Arm Dumbbell Press": "Single Arm Shoulder Press - Neutral Grip (Dumbbell)", "Dumbbell One-Arm Shoulder Press": "Single Arm Shoulder Press (Dumbbell)",
    "Close-Grip Dumbbell Press": "Bench Press - Close Grip (Dumbbell)", "Dumbbell Bench Press with Neutral Grip": "Bench Press - Neutral Grip (Dumbbell)",
    "Hammer Grip Incline DB Bench Press": "Incline Bench Press - Neutral Grip (Dumbbell)", "Incline Dumbbell Bench With Palms Facing In": "Incline Bench Press - Palms In (Dumbbell)",
    "Incline Dumbbell Press": "Incline Bench Press (Dumbbell)", "One Arm Dumbbell Bench Press": "Single Arm Bench Press (Dumbbell)",
    "Bent Over Two-Dumbbell Row": "Bent Over Row (Dumbbell)", "Bent Over Two-Dumbbell Row With Palms In": "Bent Over Row - Neutral Grip (Dumbbell)", "One-Arm Dumbbell Row": "Single Arm Row (Dumbbell)",
    "Bent Over Dumbbell Rear Delt Raise With Head On Bench": "Rear Delt Raise - Head Supported (Dumbbell)", "Front Two-Dumbbell Raise": "Front Raise - Two Arm (Dumbbell)",
    "Front Dumbbell Raise": "Front Raise (Dumbbell)", "Single Dumbbell Raise": "Front Raise - Single (Dumbbell)", "Power Partials": "Power Partial (Dumbbell)", "Straight Raises on Incline Bench": "Incline Straight Raise (Barbell)", "Dumbbell Raise": "Upright Raise (Dumbbell)",
    "Standing Dumbbell Straight-Arm Front Delt Raise Above Head": "Front Raise - Overhead (Dumbbell)", "Calf Raise On A Dumbbell": "Calf Raise on a Dumbbell",
    "Split Squat with Dumbbells": "Split Squat (Dumbbell)", "Plie Dumbbell Squat": "Plie Squat (Dumbbell)", "Dumbbell Lunges": "Lunge (Dumbbell)",
    "See-Saw Press (Alternating Side Press)": "See-Saw Press (Dumbbell)", "Concentration Curls": "Concentration Curl (Dumbbell)", "Hammer Curls": "Hammer Curl (Dumbbell)",
    "Incline Hammer Curls": "Incline Hammer Curl (Dumbbell)", "Flexor Incline Dumbbell Curls": "Incline Curl - Flexor (Dumbbell)", "Seated Triceps Press": "Seated Overhead Triceps Extension (Dumbbell)",
    "Standing One-Arm Dumbbell Curl Over Incline Bench": "Single Arm Curl over Incline Bench (Dumbbell)", "Palms-Up Dumbbell Wrist Curl Over A Bench": "Wrist Curl over Bench (Dumbbell)",
    "Palms-Down Dumbbell Wrist Curl Over A Bench": "Reverse Wrist Curl over Bench (Dumbbell)", "Seated Dumbbell Palms-Up Wrist Curl": "Seated Wrist Curl (Dumbbell)",
    "Seated Dumbbell Palms-Down Wrist Curl": "Seated Reverse Wrist Curl (Dumbbell)", "Seated One-Arm Dumbbell Palms-Up Wrist Curl": "Seated Single Arm Wrist Curl (Dumbbell)",
    "Seated One-Arm Dumbbell Palms-Down Wrist Curl": "Seated Single Arm Reverse Wrist Curl (Dumbbell)", "Around The Worlds": "Around the World (Dumbbell)",
    "Stiff-Legged Dumbbell Deadlift": "Stiff Leg Deadlift (Dumbbell)", "Preacher Hammer Dumbbell Curl": "Preacher Hammer Curl (Dumbbell)",
    # cable
    "Wide-Grip Lat Pulldown": "Lat Pulldown - Wide Grip (Cable)", "Close-Grip Front Lat Pulldown": "Lat Pulldown - Close Grip (Cable)", "V-Bar Pulldown": "Lat Pulldown - V-Bar (Cable)",
    "Underhand Cable Pulldowns": "Lat Pulldown - Underhand (Cable)", "Wide-Grip Pulldown Behind The Neck": "Lat Pulldown - Behind the Neck (Cable)",
    "Full Range-Of-Motion Lat Pulldown": "Lat Pulldown - Full Range (Cable)", "One Arm Lat Pulldown": "Single Arm Lat Pulldown (Cable)",
    "Seated Cable Rows": "Seated Row (Cable)", "Seated One-arm Cable Pulley Rows": "Single Arm Seated Row (Cable)", "Elevated Cable Rows": "Elevated Row (Cable)",
    "Triceps Pushdown - Rope Attachment": "Triceps Pushdown - Rope (Cable)", "Triceps Pushdown - V-Bar Attachment": "Triceps Pushdown - V-Bar (Cable)",
    "Reverse Grip Triceps Pushdown": "Triceps Pushdown - Reverse Grip (Cable)", "Cable Rope Overhead Triceps Extension": "Overhead Triceps Extension - Rope (Cable)",
    "Triceps Overhead Extension with Rope": "Overhead Triceps Extension - Rope, Facing Away (Cable)", "Cable One Arm Tricep Extension": "Single Arm Triceps Extension (Cable)",
    "Standing Low-Pulley One-Arm Triceps Extension": "Single Arm Overhead Triceps Extension (Cable)", "Cable Hammer Curls - Rope Attachment": "Hammer Curl - Rope (Cable)",
    "Standing Biceps Cable Curl": "Bicep Curl (Cable)", "Standing One-Arm Cable Curl": "Single Arm Curl (Cable)", "High Cable Curls": "High Curl (Cable)",
    "Lying Close-Grip Bar Curl On High Pulley": "Lying High Pulley Curl (Cable)", "Cable Crossover": "Cable Crossover", "Low Cable Crossover": "Low Cable Crossover",
    "Single-Arm Cable Crossover": "Single Arm Cable Crossover", "Flat Bench Cable Flyes": "Chest Fly - Flat Bench (Cable)", "Incline Cable Flye": "Incline Chest Fly (Cable)",
    "Cable Rear Delt Fly": "Rear Delt Fly (Cable)", "Cable Rope Rear-Delt Rows": "Rear Delt Row - Rope (Cable)", "Bent Over Low-Pulley Side Lateral": "Bent Over Lateral Raise (Cable)",
    "Standing Low-Pulley Deltoid Raise": "Lateral Raise (Cable)", "Cable Seated Lateral Raise": "Seated Lateral Raise (Cable)", "Front Cable Raise": "Front Raise (Cable)",
    "Rope Straight-Arm Pulldown": "Straight Arm Pulldown - Rope (Cable)", "Straight-Arm Pulldown": "Straight Arm Pulldown (Cable)", "Rope Crunch": "Crunch - Rope (Cable)",
    "Standing Rope Crunch": "Standing Crunch - Rope (Cable)", "Cable Crunch": "Crunch (Cable)", "Kneeling Cable Crunch With Alternating Oblique Twists": "Kneeling Crunch with Oblique Twist (Cable)",
    "Bosu Ball Cable Crunch With Side Bends": "Bosu Ball Crunch with Side Bend (Cable)", "One-Arm High-Pulley Cable Side Bends": "Single Arm Side Bend - High Pulley (Cable)",
    "One-Legged Cable Kickback": "Glute Kickback (Cable)", "External Rotation with Cable": "External Rotation (Cable)", "Seated Two-Arm Palms-Up Low-Pulley Wrist Curl": "Seated Wrist Curl (Cable)",
    "Kneeling Single-Arm High Pulley Row": "Kneeling Single Arm High Row (Cable)", "Kneeling High Pulley Row": "Kneeling High Row (Cable)", "Low Pulley Row To Neck": "Low Row to Neck (Cable)",
    "Standing Cable Wood Chop": "Wood Chop (Cable)", "Standing Cable Lift": "Standing Lift (Cable)", "Cable Russian Twists": "Russian Twist (Cable)",
    # machine
    "Ab Crunch Machine": "Crunch (Machine)", "Butterfly": "Chest Fly (Machine)", "Reverse Machine Flyes": "Reverse Fly (Machine)", "Leg Extensions": "Leg Extension (Machine)",
    "Lying Leg Curls": "Lying Leg Curl (Machine)", "Machine Shoulder (Military) Press": "Shoulder Press (Machine)", "Machine Bench Press": "Chest Press (Machine)",
    "Leverage Chest Press": "Chest Press - Plate Loaded (Machine)", "Leverage Incline Chest Press": "Incline Chest Press - Plate Loaded (Machine)",
    "Leverage Decline Chest Press": "Decline Chest Press - Plate Loaded (Machine)", "Leverage Shoulder Press": "Shoulder Press - Plate Loaded (Machine)",
    "Leverage High Row": "High Row - Plate Loaded (Machine)", "Leverage Iso Row": "Iso Row - Plate Loaded (Machine)", "Leverage Shrug": "Shrug - Plate Loaded (Machine)",
    "Leverage Deadlift": "Deadlift - Plate Loaded (Machine)", "Thigh Abductor": "Hip Abduction (Machine)", "Thigh Adductor": "Hip Adduction (Machine)",
    "Standing Calf Raises": "Standing Calf Raise (Machine)", "Calf Press On The Leg Press Machine": "Calf Press on Leg Press (Machine)", "Calf-Machine Shoulder Shrug": "Shrug on Calf Machine (Machine)",
    "Narrow Stance Hack Squats": "Hack Squat - Narrow Stance (Machine)", "Narrow Stance Leg Press": "Leg Press - Narrow Stance (Machine)", "Dip Machine": "Seated Dip (Machine)",
    "Lying T-Bar Row": "Chest Supported T-Bar Row (Machine)", "Decline Smith Press": "Decline Press (Smith Machine)", "Single-Leg Leg Extension": "Single Leg Extension (Machine)", "Smith Single-Leg Split Squat": "Single Leg Split Squat (Smith Machine)",
    "Smith Machine Overhead Shoulder Press": "Shoulder Press (Smith Machine)", "Smith Machine Decline Press": "Decline Bench Press (Smith Machine)",
    "Glute Ham Raise": "Glute Ham Raise", "Reverse Hyperextension": "Reverse Hyperextension", "Chair Squat": "Chair Squat (Smith Machine)", "Lunge Sprint": "Lunge Sprint (Smith Machine)",
    "Bicycling, Stationary": "Stationary Bike", "Jogging, Treadmill": "Treadmill Jog", "Running, Treadmill": "Treadmill Run", "Walking, Treadmill": "Treadmill Walk",
    "Rowing, Stationary": "Rowing Machine", "Stairmaster": "Stair Climber", "Elliptical Trainer": "Elliptical",
    # bodyweight
    "Pullups": "Pull Up", "Chin-Up": "Chin Up", "Pushups": "Push Up", "Pushups (Close and Wide Hand Positions)": "Push Up - Close and Wide", "Push-Up Wide": "Push Up - Wide",
    "Push-Ups - Close Triceps Position": "Push Up - Close Grip", "Push-Ups With Feet Elevated": "Push Up - Feet Elevated", "Incline Push-Up Close-Grip": "Incline Push Up - Close Grip",
    "Incline Push-Up Medium": "Incline Push Up - Medium", "Incline Push-Up Wide": "Incline Push Up - Wide", "Incline Push-Up Reverse Grip": "Incline Push Up - Reverse Grip",
    "Close-Grip Push-Up off of a Dumbbell": "Push Up - Close Grip on Dumbbell", "Handstand Push-Ups": "Handstand Push Up", "Single-Arm Push-Up": "Single Arm Push Up",
    "Plyo Push-up": "Plyo Push Up", "Dips - Triceps Version": "Triceps Dip", "Dips - Chest Version": "Chest Dip", "Bench Dips": "Bench Dip", "Crunches": "Crunch",
    "Oblique Crunches": "Oblique Crunch", "Oblique Crunches - On The Floor": "Oblique Crunch - Floor", "Crunch - Legs On Exercise Ball": "Crunch - Legs on Exercise Ball",
    "Butt Lift (Bridge)": "Glute Bridge", "Hyperextensions With No Hyperextension Bench": "Back Extension - Floor", "Hyperextensions (Back Extensions)": "Back Extension",
    "Wide-Grip Rear Pull-Up": "Pull Up - Wide Grip, Behind the Neck", "V-Bar Pullup": "Pull Up - V-Bar", "Body Tricep Press": "Bodyweight Triceps Press",
    "Frog Sit-Ups": "Frog Sit Up", "Butt-Ups": "Butt Up", "Cocoons": "Cocoon", "Alternate Heel Touchers": "Alternating Heel Touch", "Flutter Kicks": "Flutter Kick",
    "Isometric Chest Squeezes": "Isometric Chest Squeeze", "Seated Leg Tucks": "Seated Leg Tuck", "Bodyweight Flyes": "Bodyweight Fly", "Wind Sprints": "Wind Sprint",
    # EZ bar
    "EZ-Bar Curl": "Curl (EZ Bar)", "Close-Grip EZ Bar Curl": "Curl - Close Grip (EZ Bar)", "Close-Grip EZ-Bar Curl with Band": "Curl - Close Grip with Band (EZ Bar)",
    "Close-Grip EZ-Bar Press": "Bench Press - Close Grip (EZ Bar)", "EZ-Bar Skullcrusher": "Skull Crusher (EZ Bar)", "Lying Triceps Press": "Lying Triceps Extension (EZ Bar)",
    "Lying Close-Grip Barbell Triceps Press To Chin": "Lying Triceps Press to Chin (EZ Bar)", "Reverse Barbell Preacher Curls": "Reverse Preacher Curl (EZ Bar)",
    "Spider Curl": "Spider Curl (EZ Bar)", "Decline EZ Bar Triceps Extension": "Decline Triceps Extension (EZ Bar)",
    # bands
    "Band Good Morning (Pull Through)": "Pull Through (Band)", "Monster Walk": "Monster Walk (Band)", "Speed Band Overhead Triceps": "Overhead Triceps Extension - Speed (Band)",
    "Cross Over - With Bands": "Chest Crossover (Band)", "Back Flyes - With Bands": "Reverse Fly (Band)", "Squats - With Bands": "Squat (Band)", "Calf Raises - With Bands": "Calf Raise (Band)",
    # kettlebell
    "Front Squats With Two Kettlebells": "Front Squat - Double (Kettlebell)", "One-Arm Kettlebell Swings": "Single Arm Swing (Kettlebell)", "Goblet Squat": "Goblet Squat (Kettlebell)",
    "Kettlebell Turkish Get-Up (Lunge style)": "Turkish Get-Up - Lunge Style (Kettlebell)", "Kettlebell Turkish Get-Up (Squat style)": "Turkish Get-Up - Squat Style (Kettlebell)",
    "Kettlebell Pirate Ships": "Pirate Ship (Kettlebell)", "Plyo Kettlebell Pushups": "Plyo Push Up (Kettlebell)", "One-Arm Overhead Kettlebell Squats": "Single Arm Overhead Squat (Kettlebell)",
    "Bottoms-Up Clean From The Hang Position": "Bottoms-Up Hang Clean (Kettlebell)", "One-Arm Kettlebell Military Press To The Side": "Single Arm Press to the Side (Kettlebell)",
    "Two-Arm Kettlebell Military Press": "Overhead Press - Double (Kettlebell)", "Advanced Kettlebell Windmill": "Windmill - Advanced (Kettlebell)",
}

# Second pass, keyed by the name the rules produce (for leftovers that are easier to fix after the fact).
POST = {
    "Push Up with Feet on an (Exercise Ball)": "Push Up - Feet on Ball (Exercise Ball)", "Ball Leg Curl (Exercise Ball)": "Leg Curl (Exercise Ball)",
    "Physioball Hip Bridge (Exercise Ball)": "Hip Bridge (Exercise Ball)", "Weighted Ball Hyperextension (Exercise Ball)": "Weighted Back Extension (Exercise Ball)",
    "Weighted Ball Side Bend (Exercise Ball)": "Weighted Side Bend (Exercise Ball)", "Rocky Pull Up/Pulldowns": "Rocky Pull Up", "Weighted Sit Up - With Bands": "Weighted Sit Up with Bands",
    "Gironda Sternum Chins": "Gironda Sternum Chin Up", "Mixed Grip Chin": "Chin Up - Mixed Grip", "Side to Side Chins": "Side to Side Chin Up",
    "Hip Circles (prone)": "Prone Hip Circles", "Iron Crosses (stretch)": "Iron Cross Stretch", "Mountain Climbers": "Mountain Climber", "Battling Ropes": "Battle Ropes",
    "Knee/Hip Raise on Parallel Bars": "Knee Raise on Parallel Bars", "Gorilla Chin/Crunch": "Gorilla Chin Crunch", "Front Cone Hops (or hurdle hops)": "Front Cone Hops",
    "Chest Push (multiple response)": "Chest Push - Multiple Response", "Chest Push (single response)": "Chest Push - Single Response",
    "Chest Push from 3 point stance": "Chest Push from 3-Point Stance", "Box Jump (Multiple Response)": "Box Jump - Multiple Response",
    "Dumbbell Seated Box Jump": "Seated Box Jump (Dumbbell)", "Vertical Swing": "Vertical Swing (Dumbbell)", "Bodyweight Fly": "Bodyweight Fly (EZ Bar)",
}


def _tidy(name):
    name = re.sub(r"\s+", " ", name)
    name = re.sub(r"\s*-\s*(?=-|$)", "", name)          # dangling hyphen left by a removed word
    name = re.sub(r"^[\s\-,]+|[\s\-,]+$", "", name)
    return name


def _case(name):
    words = name.split(" ")
    return " ".join(w.lower() if i and w.lower() in SMALL and words[i - 1] != "-" else w for i, w in enumerate(words))


def rename(original, equipment, category):
    if original in OVERRIDES:
        return OVERRIDES[original]
    name, suffix = original, None
    if category not in NO_SUFFIX_CATEGORIES:
        own = SUFFIX_BY_FIELD.get(equipment)
        if equipment == "bands":
            cut = _tidy(re.sub(r"\s*-?\s*\bwith bands?\b|\bbands?\b", " ", name, flags=re.I))
            if cut and not DANGLING.search(cut):
                name, suffix = cut, "Band"
        else:
            for pattern, label in TOKENS:
                if re.search(pattern, name, flags=re.I):
                    cut = _tidy(re.sub(r"(?:\bwith\s+(?:a\s+)?)?(?:%s)" % pattern, " ", name, count=1, flags=re.I))
                    if cut and not DANGLING.search(cut):
                        name, suffix = cut, label
                    break
            else:
                suffix = own
    name = re.sub(r"\s*-\s*Medium Grip$", "", name)
    for pattern, repl in WORDS:
        name = re.sub(pattern, repl, name)
    base, sep, variation = name.partition(" - ")
    grip = re.match(r"^(Close|Wide|Reverse|Narrow) Grip (.+)$", base)
    if grip:                                              # "Close Grip Bench Press" -> "Bench Press - Close Grip"
        base, variation = grip.group(2), ", ".join(v for v in (f"{grip.group(1)} Grip", variation) if v)
    words = base.split(" ")
    words[-1] = SINGULAR.get(words[-1], words[-1])
    base = " ".join(words)
    name = _case(_tidy(base + (" - " + variation.strip() if variation.strip() else "")))
    name = name[0].upper() + name[1:]
    name = f"{name} ({suffix})" if suffix else name
    return POST.get(name, name)
