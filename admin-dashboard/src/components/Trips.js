import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, IconButton } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const Trips = () => {
  const [trips, setTrips] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTrip, setCurrentTrip] = useState({
    title: '', description: '', price: '', durationDays: '', startDate: '', endDate: '', maxParticipants: '', status: 'active'
  });

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/trips`);
      setTrips(response.data.trips);
    } catch (error) {
      toast.error('Failed to fetch trips');
    }
  };

  const handleOpen = (trip = null) => {
    if (trip) {
      setCurrentTrip({
        ...trip,
        durationDays: trip.duration_days,
        startDate: trip.start_date,
        endDate: trip.end_date,
        maxParticipants: trip.max_participants
      });
      setEditMode(true);
    } else {
      setCurrentTrip({ title: '', description: '', price: '', durationDays: '', startDate: '', endDate: '', maxParticipants: '', status: 'active' });
      setEditMode(false);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentTrip({ title: '', description: '', price: '', durationDays: '', startDate: '', endDate: '', maxParticipants: '', status: 'active' });
  };

  const handleSave = async () => {
    try {
      if (editMode) {
        await axios.put(`${API_URL}/api/trips/${currentTrip.id}`, currentTrip);
        toast.success('Trip updated successfully');
      } else {
        await axios.post(`${API_URL}/api/trips`, currentTrip);
        toast.success('Trip created successfully');
      }
      fetchTrips();
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      try {
        await axios.delete(`${API_URL}/api/trips/${id}`);
        toast.success('Trip deleted successfully');
        fetchTrips();
      } catch (error) {
        toast.error('Failed to delete trip');
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Trips Management</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>
          Add Trip
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Duration (Days)</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trips.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell>{trip.title}</TableCell>
                <TableCell>${trip.price}</TableCell>
                <TableCell>{trip.duration_days}</TableCell>
                <TableCell>{new Date(trip.start_date).toLocaleDateString()}</TableCell>
                <TableCell>{trip.status}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(trip)} color="primary">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(trip.id)} color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editMode ? 'Edit Trip' : 'Add Trip'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={currentTrip.title}
            onChange={(e) => setCurrentTrip({ ...currentTrip, title: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={currentTrip.description}
            onChange={(e) => setCurrentTrip({ ...currentTrip, description: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Price"
            type="number"
            value={currentTrip.price}
            onChange={(e) => setCurrentTrip({ ...currentTrip, price: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Duration (Days)"
            type="number"
            value={currentTrip.durationDays}
            onChange={(e) => setCurrentTrip({ ...currentTrip, durationDays: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={currentTrip.startDate}
            onChange={(e) => setCurrentTrip({ ...currentTrip, startDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="End Date"
            type="date"
            value={currentTrip.endDate}
            onChange={(e) => setCurrentTrip({ ...currentTrip, endDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Max Participants"
            type="number"
            value={currentTrip.maxParticipants}
            onChange={(e) => setCurrentTrip({ ...currentTrip, maxParticipants: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={currentTrip.status}
              onChange={(e) => setCurrentTrip({ ...currentTrip, status: e.target.value })}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Trips;
