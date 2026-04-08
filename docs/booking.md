# Booking Agent

## Goal
Handle booking requests from users and confirm valid appointments.

## Inputs
- name (string)
- phone (string)
- requested_time (string)

## Rules
- All fields must be present
- Time must not be empty
- Return clear confirmation

## Output
{
  "status": "confirmed",
  "message": "Booking successful",
  "booking": {
    "name": "",
    "phone": "",
    "time": ""
  }
}