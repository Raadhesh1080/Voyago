const request = require('supertest');
const app = require('../src/index');

describe('Trip Service', () => {
  let tripId;

  describe('POST /api/trips', () => {
    it('should create a new trip', async () => {
      const res = await request(app)
        .post('/api/trips')
        .send({
          title: 'European Adventure',
          description: 'Explore Europe',
          price: 2500.00,
          durationDays: 10,
          startDate: '2024-06-01',
          endDate: '2024-06-10',
          maxParticipants: 20
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      tripId = res.body.id;
    });
  });

  describe('GET /api/trips', () => {
    it('should get all trips', async () => {
      const res = await request(app).get('/api/trips');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('trips');
    });
  });

  describe('GET /api/trips/:id', () => {
    it('should get trip by id', async () => {
      const res = await request(app).get(`/api/trips/${tripId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe('European Adventure');
    });
  });

  describe('PUT /api/trips/:id', () => {
    it('should update trip', async () => {
      const res = await request(app)
        .put(`/api/trips/${tripId}`)
        .send({
          title: 'Updated European Adventure',
          description: 'Explore Europe Updated',
          price: 2600.00,
          durationDays: 10,
          startDate: '2024-06-01',
          endDate: '2024-06-10',
          maxParticipants: 25,
          status: 'active'
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe('Updated European Adventure');
    });
  });

  describe('DELETE /api/trips/:id', () => {
    it('should delete trip', async () => {
      const res = await request(app).delete(`/api/trips/${tripId}`);
      expect(res.statusCode).toBe(200);
    });
  });
});
